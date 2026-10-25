import { createExampleMusicDefinition } from "../core/audio";
import { zzfxSample } from "../sys/zzfx";

const kickSample = zzfxSample(1.8,0,72,0,0,.2,0,4,-2,6,50,.15,0,6);
const leadSample = zzfxSample(1,.05,440,.01,.05,.08,1,1,0,0,0,0,0,0,0,0,0,.6,.05,0,0);

export const exampleMusic = createExampleMusicDefinition(kickSample, leadSample);
