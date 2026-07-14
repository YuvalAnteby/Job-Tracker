import { describe, expect, it } from 'vitest';
import { ApplicationStage } from '../../types';
import { nextStages } from './pipeline-utils';

describe('nextStages', () => {
  it('allows skipped rounds and reopening while blocking an initial jump', () => {
    expect(nextStages(ApplicationStage.NOT_APPLIED)).toEqual([
      ApplicationStage.APPLIED,
    ]);
    expect(nextStages(ApplicationStage.RECRUITER_SCREEN)).toContain(
      ApplicationStage.OFFER,
    );
    expect(nextStages(ApplicationStage.REJECTED)).toEqual([
      ApplicationStage.NOT_APPLIED,
      ApplicationStage.APPLIED,
    ]);
  });
});
