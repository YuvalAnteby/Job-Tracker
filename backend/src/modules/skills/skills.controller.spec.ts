import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

describe('SkillsController', () => {
  it('delegates matrix filters to the service', async () => {
    const getMatrix = jest.fn().mockResolvedValue({ skills: [] });
    const controller = new SkillsController({
      getMatrix,
    } as unknown as SkillsService);

    await controller.getMatrix({ include_research: true });

    expect(getMatrix).toHaveBeenCalledWith(undefined, true);
  });
});
