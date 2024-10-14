import { federationReleaseTagManager } from '@/release/commands/create/managers/federationReleaseTagManager';
import { libraryReleaseManager } from '@/release/commands/create/managers/libraryReleaseManager';
import { semanticReleaseTagManager } from '@/release/commands/create/managers/semanticReleaseTagManager';
import { stableDateReleaseTagManager } from '@/release/commands/create/managers/stableDateReleaseTagManager';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';
import type { ReleaseManager } from '@/release/typings/ReleaseManager';
import type { ReleaseTagManager } from '@/release/typings/ReleaseTagManager';
import { buildProjectReleaseConfigs } from '@/release/utils/configBuilder';
import projectsConfig from '@root/config/homer/projects.json';

const releaseManagers: Record<string, ReleaseManager> = {
  libraryReleaseManager,
};
const releaseTagManagers: Record<string, ReleaseTagManager> = {
  federationReleaseTagManager,
  semanticReleaseTagManager,
  stableDateReleaseTagManager,
};

export default class ConfigHelper {
  private static projectReleaseConfigs: ProjectReleaseConfig[];

  private static async init() {
    if (this.projectReleaseConfigs === undefined) {
      this.projectReleaseConfigs = await buildProjectReleaseConfigs(
        projectsConfig,
        releaseManagers,
        releaseTagManagers
      );
    }
  }

  static async getChannelProjectReleaseConfigs(
    channelId: string
  ): Promise<ProjectReleaseConfig[]> {
    await this.init();
    return this.projectReleaseConfigs.filter(
      (config) => config.releaseChannelId === channelId
    );
  }

  static async hasChannelReleaseConfigs(channelId: string): Promise<boolean> {
    return (await this.getChannelProjectReleaseConfigs(channelId)).length > 0;
  }

  static async getProjectReleaseConfig(
    projectId: number
  ): Promise<ProjectReleaseConfig> {
    await this.init();
    const projectReleaseConfig = this.projectReleaseConfigs.find(
      (config) => config.projectId === projectId
    );

    if (projectReleaseConfig === undefined) {
      throw new Error(`Unable to find release config for project ${projectId}`);
    }
    return projectReleaseConfig;
  }

  static async hasProjectReleaseConfig(projectId: number): Promise<boolean> {
    await this.init();
    const projectReleaseConfig = this.projectReleaseConfigs.find(
      (config) => config.projectId === projectId
    );
    return projectReleaseConfig !== undefined;
  }
}
