import { ApplicationStage } from '../../types';

export const stageOrder = Object.values(ApplicationStage);

export const stageLabel = (stage: ApplicationStage): string =>
  stage
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (value) => value.toUpperCase());

export const nextStages = (stage: ApplicationStage): ApplicationStage[] => {
  if (stage === ApplicationStage.NOT_APPLIED) return [ApplicationStage.APPLIED];
  if (
    stage === ApplicationStage.REJECTED ||
    stage === ApplicationStage.WITHDRAWN
  ) {
    return [ApplicationStage.NOT_APPLIED, ApplicationStage.APPLIED];
  }
  const laterStages = stageOrder
    .slice(stageOrder.indexOf(stage) + 1)
    .filter(
      (value) =>
        value !== ApplicationStage.REJECTED &&
        value !== ApplicationStage.WITHDRAWN,
    );
  return [
    ...laterStages,
    ApplicationStage.REJECTED,
    ApplicationStage.WITHDRAWN,
  ].filter((value, index, values) => values.indexOf(value) === index);
};
