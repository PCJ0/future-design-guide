/* Stateful averaging resampler: device sample rate -> mono 16 kHz, little-endian PCM16.
   AudioWorklet runs independently of animation and layout work. */
class GuidePCM extends AudioWorkletProcessor {
  constructor(){super();this.ratio=sampleRate/16000;this.weight=0;this.sum=0;this.frame=new Int16Array(1600);this.offset=0;}
  process(inputs){
    const input=inputs[0]?.[0];if(!input)return true;
    for(const sample of input){
      let remaining=1;
      while(remaining>1e-8){
        const part=Math.min(remaining,this.ratio-this.weight);
        this.sum+=sample*part;this.weight+=part;remaining-=part;
        if(this.weight>=this.ratio-1e-8){
          const value=Math.max(-1,Math.min(1,this.sum/this.ratio));
          this.frame[this.offset++]=Math.round(value*(value<0?32768:32767));
          this.sum=0;this.weight=0;
          if(this.offset===this.frame.length){this.port.postMessage(this.frame.buffer,[this.frame.buffer]);this.frame=new Int16Array(1600);this.offset=0;}
        }
      }
    }
    return true;
  }
}
registerProcessor('guide-pcm',GuidePCM);
