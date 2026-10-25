import { zzfxCtx, zzfxVolume } from "../sys/zzfx";
import {
	kWindowEventBlur,
	kWindowEventFocus,
	windowAddEventListener,
} from "../sys/window";

interface MusicPattern<T> {
  mPattern: T[];
  mTrack: number[];
}

type MusicUntunedPattern = MusicPattern<number>;
type MusicTunedPattern = MusicPattern<[number[], number[], number[][]]>;

export interface MusicTrack<T extends MusicUntunedPattern | MusicTunedPattern> {
  mInstrumentSample: number[];
	mPatterns: T[];
  mVolume: number;
  mPan: number;
}

export interface MusicDefinition {
  mUntunedTracks: MusicTrack<MusicUntunedPattern>[];
  mTunedTracks: MusicTrack<MusicTunedPattern>[];
  mTempo: number;
}

export const createExampleMusicDefinition = (kickSample: number[], leadSample: number[]): MusicDefinition => ({
	mTempo: 120,
	mUntunedTracks: [
		{
			mInstrumentSample: kickSample,
			mVolume: 0.9,
			mPan: 0,
			mPatterns: [
				{
					mPattern: [0x1111],
					mTrack: [0, 0, 0, 0],
				},
			],
		},
	],
	mTunedTracks: [
		{
			mInstrumentSample: leadSample,
			mVolume: 0.45,
			mPan: 0.1,
			mPatterns: [
				{
					mPattern: [
						[
							[0x11111111],
							[0x0F0F0F0F, 0xAF8F0F0F],
							[
								[4, 7],
								[3, 7],
							],
						],
					],
					mTrack: [0, 0],
				},
			],
		},
	],
});

export type AudioSource = AudioBufferSourceNode & {
	mGainNode: GainNode;
	mPanNode: StereoPannerNode;
};

export const generateMusic = (def: MusicDefinition): AudioBuffer => {
	const stepsPerBeat = 4;
	const untunedPatternSteps = 16;
	const tunedPatternSteps = untunedPatternSteps * 2;
	const stepSeconds = 60 / def.mTempo / stepsPerBeat;
	const stepSamples = zzfxCtx.sampleRate * stepSeconds;

	type NoteEvent = {
		startSample: number;
		sample: number[];
		rate: number;
		gainL: number;
		gainR: number;
	};

	const bitAt = (value: number, bit: number) => (value >>> bit) & 1;

	const unpackMelodyBytes = (packed: number[]) => {
		const notes: number[] = [];
		for (let i = 0; i < packed.length; ++i) {
			const v = packed[i] >>> 0;
			notes.push(v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255);
		}
		return notes;
	};

	const semitoneToRate = (semitones: number) => 2 ** (semitones / 12);

	const panToGains = (pan: number) => {
		const clampedPan = pan < -1 ? -1 : pan > 1 ? 1 : pan;
		const t = (clampedPan + 1) * 0.5;
		const angle = t * (Math.PI * 0.5);
		return {
			l: Math.cos(angle),
			r: Math.sin(angle),
		};
	};

	const events: NoteEvent[] = [];
	let totalSteps = 0;
	let maxEndSample = 0;

	const pushEvent = (
		step: number,
		sample: number[],
		semitoneOffset: number,
		trackVolume: number,
		trackPan: number
	) => {
		if (!sample.length || trackVolume <= 0) {
			return;
		}

		const rate = semitoneToRate(semitoneOffset);
		if (rate <= 0) {
			return;
		}

		const startSample = (step * stepSamples) | 0;
		const panGains = panToGains(trackPan);
		const gain = trackVolume;
		const gainL = panGains.l * gain;
		const gainR = panGains.r * gain;
		const endSample = startSample + ((sample.length / rate) | 0) + 2;

		events.push({
			startSample,
			sample,
			rate,
			gainL,
			gainR,
		});

		if (endSample > maxEndSample) {
			maxEndSample = endSample;
		}
	};

	for (let trackIndex = 0; trackIndex < def.mUntunedTracks.length; ++trackIndex) {
		const track = def.mUntunedTracks[trackIndex];

		for (let patternGroupIndex = 0; patternGroupIndex < track.mPatterns.length; ++patternGroupIndex) {
			const patternGroup = track.mPatterns[patternGroupIndex];
			const patternBlocks = patternGroup.mPattern;
			const patternTrack = patternGroup.mTrack;

			for (let blockIndex = 0; blockIndex < patternTrack.length; ++blockIndex) {
				const patternIndex = patternTrack[blockIndex] | 0;
				const pattern = patternBlocks[patternIndex] | 0;
				const blockStartStep = blockIndex * untunedPatternSteps;

				for (let bit = 0; bit < untunedPatternSteps; ++bit) {
					if (!bitAt(pattern, bit)) {
						continue;
					}

					pushEvent(blockStartStep + bit, track.mInstrumentSample, 0, track.mVolume, track.mPan);
				}
			}

			const steps = patternTrack.length * untunedPatternSteps;
			if (steps > totalSteps) {
				totalSteps = steps;
			}
		}
	}

	for (let trackIndex = 0; trackIndex < def.mTunedTracks.length; ++trackIndex) {
		const track = def.mTunedTracks[trackIndex];

		for (let patternGroupIndex = 0; patternGroupIndex < track.mPatterns.length; ++patternGroupIndex) {
			const patternGroup = track.mPatterns[patternGroupIndex];
			const patternBlocks = patternGroup.mPattern;
			const patternTrack = patternGroup.mTrack;

			for (let blockIndex = 0; blockIndex < patternTrack.length; ++blockIndex) {
				const patternIndex = patternTrack[blockIndex] | 0;
				const pattern = patternBlocks[patternIndex];
				if (!pattern) {
					continue;
				}

				const [rhythmWords, melodyWords, chords] = pattern;
				const melody = unpackMelodyBytes(melodyWords);
				let melodyPtr = 0;
				const blockStartStep = blockIndex * tunedPatternSteps;
				let stepInBlock = 0;

				for (let wordIndex = 0; wordIndex < rhythmWords.length && stepInBlock < tunedPatternSteps; ++wordIndex) {
					const rhythmWord = rhythmWords[wordIndex] >>> 0;

					for (let bit = 0; bit < 32 && stepInBlock < tunedPatternSteps; ++bit, ++stepInBlock) {
						if (!bitAt(rhythmWord, bit)) {
							continue;
						}

						if (melodyPtr >= melody.length) {
							continue;
						}

						const noteByte = melody[melodyPtr++] & 255;
						const isChord = (noteByte & 0x80) !== 0;
						const chordIndex = (noteByte >>> 5) & 0x03;
						const rootSemitone = (noteByte & 0x1f) - 15;
						const noteStep = blockStartStep + stepInBlock;

						pushEvent(noteStep, track.mInstrumentSample, rootSemitone, track.mVolume, track.mPan);

						if (!isChord) {
							continue;
						}

						const chordShape = chords[chordIndex] || [];
						for (let i = 0; i < chordShape.length; ++i) {
							pushEvent(
								noteStep,
								track.mInstrumentSample,
								rootSemitone + chordShape[i],
								track.mVolume,
								track.mPan
							);
						}
					}
				}
			}

			const steps = patternTrack.length * tunedPatternSteps;
			if (steps > totalSteps) {
				totalSteps = steps;
			}
		}
	}

	if (maxEndSample === 0) {
		const fallbackLength = Math.max(1, (totalSteps * stepSamples) | 0);
		return zzfxCtx.createBuffer(2, fallbackLength, zzfxCtx.sampleRate);
	}

	const renderLength = Math.max(maxEndSample, (totalSteps * stepSamples) | 0);
	const left = new Float32Array(renderLength);
	const right = new Float32Array(renderLength);

	for (let eventIndex = 0; eventIndex < events.length; ++eventIndex) {
		const event = events[eventIndex];
		const sample = event.sample;
		const rate = event.rate;
		let sourcePos = 0;
		let dst = event.startSample;

		while (dst < renderLength) {
			const srcIndex = sourcePos | 0;
			if (srcIndex >= sample.length) {
				break;
			}

			const frac = sourcePos - srcIndex;
			const a = sample[srcIndex];
			const b = srcIndex + 1 < sample.length ? sample[srcIndex + 1] : 0;
			const v = a + (b - a) * frac;

			left[dst] += v * event.gainL;
			right[dst] += v * event.gainR;

			sourcePos += rate;
			++dst;
		}
	}

	let peak = 0;
	for (let i = 0; i < renderLength; ++i) {
		const l = Math.abs(left[i]);
		const r = Math.abs(right[i]);
		if (l > peak) {
			peak = l;
		}
		if (r > peak) {
			peak = r;
		}
	}

	if (peak > 1) {
		const invPeak = 1 / peak;
		for (let i = 0; i < renderLength; ++i) {
			left[i] *= invPeak;
			right[i] *= invPeak;
		}
	}

	const buffer = zzfxCtx.createBuffer(2, renderLength, zzfxCtx.sampleRate);
	buffer.getChannelData(0).set(left);
	buffer.getChannelData(1).set(right);

	return buffer;
}

export const audioPlay = (sample: AudioBuffer, vol: number = 1, pan: number = 0, rate: number = 1, loop: boolean = false): AudioSource => {
	const source = zzfxCtx.createBufferSource() as AudioSource;
	const gainNode = zzfxCtx.createGain();
	const panNode = zzfxCtx.createStereoPanner();

	source.buffer = sample;
	source.playbackRate.value = rate;
	source.loop = loop;

	gainNode.gain.value = vol * zzfxVolume;
	panNode.pan.value = pan;

	source.mGainNode = gainNode;
	source.mPanNode = panNode;

	source.connect(gainNode);
	gainNode.connect(panNode);
	panNode.connect(zzfxCtx.destination);

	source.start();

	return source;
};

windowAddEventListener(kWindowEventBlur, () => {
	zzfxCtx.suspend();
});

windowAddEventListener(kWindowEventFocus, () => {
	zzfxCtx.resume();
});
