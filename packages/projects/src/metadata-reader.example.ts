import {
  readAgentsMetadata,
  readContextMetadata,
  readPackageMetadata,
  readProjectMetadata,
} from "./metadata-reader.js";

interface ProjectMetadataExample {
  readonly projectRoot: string;
  readonly packageName: string | undefined;
  readonly contextFilePath: string;
  readonly agentsFilePath: string;
  readonly hasPackageMetadata: boolean;
  readonly hasProjectContext: boolean;
  readonly hasAgents: boolean;
}

interface MetadataPresenceExample {
  readonly path: string;
  readonly exists: boolean;
}

export function readProjectRootExample(
  projectRoot: string,
): ProjectMetadataExample {
  const metadata = readProjectMetadata(projectRoot);

  return {
    projectRoot: metadata.projectRoot,
    packageName: metadata.packageName,
    contextFilePath: metadata.context.path,
    agentsFilePath: metadata.agents.path,
    hasPackageMetadata: metadata.package.exists,
    hasProjectContext: metadata.hasProjectContext,
    hasAgents: metadata.hasAgents,
  };
}

export function readPackageMetadataExample(
  projectRoot: string,
): MetadataPresenceExample {
  const packageMetadata = readPackageMetadata(projectRoot);

  return {
    path: packageMetadata.path,
    exists: packageMetadata.exists,
  };
}

export function readProjectContextPresenceExample(
  projectRoot: string,
): MetadataPresenceExample {
  const contextMetadata = readContextMetadata(projectRoot);

  return {
    path: contextMetadata.path,
    exists: contextMetadata.exists,
  };
}

export function readAgentsPresenceExample(
  projectRoot: string,
): MetadataPresenceExample {
  const agentsMetadata = readAgentsMetadata(projectRoot);

  return {
    path: agentsMetadata.path,
    exists: agentsMetadata.exists,
  };
}
