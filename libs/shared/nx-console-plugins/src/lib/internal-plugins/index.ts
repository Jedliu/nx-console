import { NxConsolePluginsDefinition } from '../nx-console-plugin-types';
import { filterInternalAndDeprecatedProcessor } from './filter-internal-and-deprecated-processor';
import { gitCleanMessageFactory } from './git-clean-message-factory';
import {
  nameAndDirectoryProcessor,
  nameAndDirectoryStartupMessage,
} from './name-and-directory.plugin';
import { prefillProjectAndDirProcessor } from './prefill-project-and-dir-processor';
import {
  projectNameAndRootStartupMessage,
  projectNameAndRootProcessor,
} from './project-name-and-root-plugin';

export const internalPlugins: NxConsolePluginsDefinition = {
  schemaProcessors: [
    projectNameAndRootProcessor,
    filterInternalAndDeprecatedProcessor,
    prefillProjectAndDirProcessor,
    nameAndDirectoryProcessor,
  ],
  validators: [],
  startupMessageFactories: [
    gitCleanMessageFactory,
    projectNameAndRootStartupMessage,
    nameAndDirectoryStartupMessage,
  ],
};
