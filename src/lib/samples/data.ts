import { SYNTHETIC_SAMPLE_RECORDS } from "./fixtures";
import type { SampleDataSource } from "./types";

export const sampleDataSource: SampleDataSource = {
  async listSamples() {
    return SYNTHETIC_SAMPLE_RECORDS;
  },
};
