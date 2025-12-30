/**
 * Audio Stream Manager
 * Handles audio format conversion and buffering between Telnyx and OpenAI
 */

export class AudioStreamManager {
  /**
   * Convert µ-law (8kHz, 8-bit) to PCM16 (24kHz, 16-bit)
   * Telnyx uses µ-law, OpenAI Realtime uses PCM16
   */
  static mulawToPcm16(mulawBuffer: Buffer): Buffer {
    const mulawData = new Uint8Array(mulawBuffer);
    const pcmData = new Int16Array(mulawData.length);

    // µ-law decoding table
    const MULAW_BIAS = 0x84;
    const MULAW_MAX = 0x1fff;

    for (let i = 0; i < mulawData.length; i++) {
      let mulaw = ~mulawData[i];
      let sign = mulaw & 0x80;
      let exponent = (mulaw >> 4) & 0x07;
      let mantissa = mulaw & 0x0f;

      let sample = mantissa << (exponent + 3);
      sample += MULAW_BIAS << exponent;
      if (exponent === 0) sample += MULAW_BIAS >> 1;
      if (sign !== 0) sample = -sample;

      pcmData[i] = sample;
    }

    // Resample from 8kHz to 24kHz (3x upsampling)
    const resampledLength = pcmData.length * 3;
    const resampled = new Int16Array(resampledLength);

    for (let i = 0; i < pcmData.length - 1; i++) {
      const current = pcmData[i];
      const next = pcmData[i + 1];

      // Linear interpolation for upsampling
      resampled[i * 3] = current;
      resampled[i * 3 + 1] = Math.round(current * 0.67 + next * 0.33);
      resampled[i * 3 + 2] = Math.round(current * 0.33 + next * 0.67);
    }

    // Handle last sample
    resampled[resampledLength - 1] = pcmData[pcmData.length - 1];

    return Buffer.from(resampled.buffer);
  }

  /**
   * Convert PCM16 (24kHz, 16-bit) to µ-law (8kHz, 8-bit)
   * OpenAI Realtime outputs PCM16, Telnyx expects µ-law
   */
  static pcm16ToMulaw(pcm16Buffer: Buffer): Buffer {
    const pcmData = new Int16Array(
      pcm16Buffer.buffer,
      pcm16Buffer.byteOffset,
      pcm16Buffer.length / 2
    );

    // Downsample from 24kHz to 8kHz (take every 3rd sample)
    const downsampledLength = Math.floor(pcmData.length / 3);
    const downsampled = new Int16Array(downsampledLength);

    for (let i = 0; i < downsampledLength; i++) {
      downsampled[i] = pcmData[i * 3];
    }

    // Convert to µ-law
    const mulawData = new Uint8Array(downsampledLength);
    const MULAW_BIAS = 0x84;
    const MULAW_CLIP = 32635;

    for (let i = 0; i < downsampledLength; i++) {
      let sample = downsampled[i];
      let sign = (sample >> 8) & 0x80;

      if (sign !== 0) sample = -sample;
      if (sample > MULAW_CLIP) sample = MULAW_CLIP;
      sample += MULAW_BIAS;

      let exponent = 7;
      for (let exp = 0; exp < 8; exp++) {
        if (sample <= 0x1f << (exp + 3)) {
          exponent = exp;
          break;
        }
      }

      let mantissa = (sample >> (exponent + 3)) & 0x0f;
      let mulaw = ~(sign | (exponent << 4) | mantissa);

      mulawData[i] = mulaw & 0xff;
    }

    return Buffer.from(mulawData);
  }

  /**
   * Buffer audio chunks and process in appropriate sizes
   */
  static createAudioBuffer(chunkSizeMs: number = 100) {
    const SAMPLE_RATE_8KHZ = 8000;
    const SAMPLE_RATE_24KHZ = 24000;
    const BYTES_PER_SAMPLE_MULAW = 1;
    const BYTES_PER_SAMPLE_PCM16 = 2;

    return {
      mulawBuffer: Buffer.alloc(0),
      pcm16Buffer: Buffer.alloc(0),

      /**
       * Add µ-law chunk and return complete chunks
       */
      addMulawChunk(chunk: Buffer): Buffer[] {
        this.mulawBuffer = Buffer.concat([this.mulawBuffer, chunk]);

        const chunkSize =
          (SAMPLE_RATE_8KHZ * chunkSizeMs * BYTES_PER_SAMPLE_MULAW) / 1000;
        const chunks: Buffer[] = [];

        while (this.mulawBuffer.length >= chunkSize) {
          chunks.push(this.mulawBuffer.slice(0, chunkSize));
          this.mulawBuffer = this.mulawBuffer.slice(chunkSize);
        }

        return chunks;
      },

      /**
       * Add PCM16 chunk and return complete chunks
       */
      addPcm16Chunk(chunk: Buffer): Buffer[] {
        this.pcm16Buffer = Buffer.concat([this.pcm16Buffer, chunk]);

        const chunkSize =
          (SAMPLE_RATE_24KHZ * chunkSizeMs * BYTES_PER_SAMPLE_PCM16) / 1000;
        const chunks: Buffer[] = [];

        while (this.pcm16Buffer.length >= chunkSize) {
          chunks.push(this.pcm16Buffer.slice(0, chunkSize));
          this.pcm16Buffer = this.pcm16Buffer.slice(chunkSize);
        }

        return chunks;
      },

      /**
       * Flush remaining buffer
       */
      flush(): { mulaw: Buffer | null; pcm16: Buffer | null } {
        const result = {
          mulaw: this.mulawBuffer.length > 0 ? this.mulawBuffer : null,
          pcm16: this.pcm16Buffer.length > 0 ? this.pcm16Buffer : null,
        };

        this.mulawBuffer = Buffer.alloc(0);
        this.pcm16Buffer = Buffer.alloc(0);

        return result;
      },
    };
  }

  /**
   * Validate audio format
   */
  static validateAudioFormat(
    buffer: Buffer,
    expectedFormat: "mulaw" | "pcm16"
  ): boolean {
    if (buffer.length === 0) return false;

    if (expectedFormat === "mulaw") {
      // µ-law should be 8-bit, any length is valid
      return true;
    }

    if (expectedFormat === "pcm16") {
      // PCM16 should be 16-bit aligned
      return buffer.length % 2 === 0;
    }

    return false;
  }

  /**
   * Calculate audio duration in milliseconds
   */
  static calculateDuration(buffer: Buffer, format: "mulaw" | "pcm16"): number {
    if (format === "mulaw") {
      // 8kHz, 8-bit (1 byte per sample)
      const samples = buffer.length;
      return (samples / 8000) * 1000;
    } else {
      // 24kHz, 16-bit (2 bytes per sample)
      const samples = buffer.length / 2;
      return (samples / 24000) * 1000;
    }
  }

  /**
   * Convert base64 audio to Buffer
   */
  static base64ToBuffer(base64: string): Buffer {
    return Buffer.from(base64, "base64");
  }

  /**
   * Convert Buffer to base64
   */
  static bufferToBase64(buffer: Buffer): string {
    return buffer.toString("base64");
  }
}
