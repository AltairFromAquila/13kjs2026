import { zzfxCtx, zzfxVolume } from "../sys/zzfx";
import {
	kWindowEventBlur,
	kWindowEventFocus,
	windowAddEventListener,
} from "../sys/window";

export type AudioSource = AudioBufferSourceNode & {
	gainNode: GainNode;
	panNode: StereoPannerNode;
};

export const audioPlay = (sample: AudioBuffer, vol: number = 1, pan: number = 0, rate: number = 1, loop: boolean = false): AudioSource => {
	const source = zzfxCtx.createBufferSource() as AudioSource;
	const gainNode = zzfxCtx.createGain();
	const panNode = zzfxCtx.createStereoPanner();

	source.buffer = sample;
	source.playbackRate.value = rate;
	source.loop = loop;

	gainNode.gain.value = vol * zzfxVolume;
	panNode.pan.value = pan;

	source.gainNode = gainNode;
	source.panNode = panNode;

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
