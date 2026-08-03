import type {
  ProjectConfidence,
  ProjectFramework,
  ProjectInfrastructure,
  ProjectIntelligenceCategory,
  ProjectLanguage,
  ProjectMonorepoKind,
  ProjectPackageManager,
  ProjectRuntime,
} from "./intelligence.js";

export type ProjectIntelligenceSignalCategory = ProjectIntelligenceCategory;

export type ProjectIntelligenceSignalSource =
  | "file"
  | "directory"
  | "manifest"
  | "lockfile"
  | "dependency"
  | "config";

export type ProjectIntelligenceSignalMatchKind =
  | "basename"
  | "extension"
  | "relative_path"
  | "dependency_name"
  | "manifest_name"
  | "directory_name";

export type ProjectIntelligenceSignalTarget =
  | ProjectLanguage
  | ProjectFramework
  | ProjectPackageManager
  | ProjectRuntime
  | ProjectInfrastructure
  | ProjectMonorepoKind;

export interface ProjectIntelligenceSignalDefinition {
  readonly id: string;
  readonly category: ProjectIntelligenceSignalCategory;
  readonly target: ProjectIntelligenceSignalTarget;
  readonly source: ProjectIntelligenceSignalSource;
  readonly matchKind: ProjectIntelligenceSignalMatchKind;
  readonly pattern: string;
  readonly confidence: ProjectConfidence;
  readonly reason: string;
}

export const PROJECT_INTELLIGENCE_SIGNAL_DEFINITIONS: readonly ProjectIntelligenceSignalDefinition[] =
  [
    signal("language.typescript.tsconfig", "language", "typescript", "config", "basename", "tsconfig.json", "high", "TypeScript project configuration is present."),
    signal("language.typescript.ts", "language", "typescript", "file", "extension", ".ts", "low", "TypeScript source files are present."),
    signal("language.typescript.tsx", "language", "typescript", "file", "extension", ".tsx", "low", "TypeScript React source files are present."),

    signal("language.javascript.package_json", "language", "javascript", "manifest", "manifest_name", "package.json", "high", "Node package manifest is present."),
    signal("language.javascript.js", "language", "javascript", "file", "extension", ".js", "low", "JavaScript source files are present."),
    signal("language.javascript.jsx", "language", "javascript", "file", "extension", ".jsx", "low", "JavaScript React source files are present."),

    signal("language.php.composer_json", "language", "php", "manifest", "manifest_name", "composer.json", "high", "Composer manifest is present."),
    signal("language.php.php", "language", "php", "file", "extension", ".php", "low", "PHP source files are present."),
    signal("language.php.wp_config", "language", "php", "file", "basename", "wp-config.php", "high", "WordPress PHP configuration is present."),

    signal("language.python.pyproject", "language", "python", "manifest", "manifest_name", "pyproject.toml", "high", "Python project manifest is present."),
    signal("language.python.requirements", "language", "python", "manifest", "manifest_name", "requirements.txt", "medium", "Python requirements manifest is present."),
    signal("language.python.py", "language", "python", "file", "extension", ".py", "low", "Python source files are present."),

    signal("language.go.go_mod", "language", "go", "manifest", "manifest_name", "go.mod", "high", "Go module manifest is present."),
    signal("language.go.go", "language", "go", "file", "extension", ".go", "low", "Go source files are present."),

    signal("language.rust.cargo_toml", "language", "rust", "manifest", "manifest_name", "Cargo.toml", "high", "Cargo manifest is present."),
    signal("language.rust.rs", "language", "rust", "file", "extension", ".rs", "low", "Rust source files are present."),

    signal("framework.wordpress.wp_config", "framework", "wordpress", "file", "basename", "wp-config.php", "high", "WordPress configuration file is present."),
    signal("framework.wordpress.wp_content", "framework", "wordpress", "directory", "directory_name", "wp-content", "high", "WordPress content directory is present."),
    signal("framework.wordpress.composer_dependency", "framework", "wordpress", "dependency", "dependency_name", "johnpbloch/wordpress", "medium", "WordPress Composer dependency is declared."),

    signal("framework.nextjs.config_js", "framework", "nextjs", "config", "basename", "next.config.js", "high", "Next.js configuration is present."),
    signal("framework.nextjs.config_mjs", "framework", "nextjs", "config", "basename", "next.config.mjs", "high", "Next.js configuration is present."),
    signal("framework.nextjs.config_ts", "framework", "nextjs", "config", "basename", "next.config.ts", "high", "Next.js configuration is present."),
    signal("framework.nextjs.dependency", "framework", "nextjs", "dependency", "dependency_name", "next", "medium", "Next.js package dependency is declared."),
    signal("framework.nextjs.app_directory", "framework", "nextjs", "directory", "directory_name", "app", "low", "Conventional Next.js app directory is present."),
    signal("framework.nextjs.pages_directory", "framework", "nextjs", "directory", "directory_name", "pages", "low", "Conventional Next.js pages directory is present."),

    signal("framework.react.dependency", "framework", "react", "dependency", "dependency_name", "react", "medium", "React package dependency is declared."),
    signal("framework.react.vite_config_js", "framework", "react", "config", "basename", "vite.config.js", "medium", "Vite configuration may support a React application."),
    signal("framework.react.vite_config_ts", "framework", "react", "config", "basename", "vite.config.ts", "medium", "Vite configuration may support a React application."),

    signal("framework.laravel.artisan", "framework", "laravel", "file", "basename", "artisan", "high", "Laravel artisan entrypoint is present."),
    signal("framework.laravel.dependency", "framework", "laravel", "dependency", "dependency_name", "laravel/framework", "medium", "Laravel framework dependency is declared."),

    signal("framework.fastapi.dependency", "framework", "fastapi", "dependency", "dependency_name", "fastapi", "medium", "FastAPI dependency is declared."),
    signal("framework.fastapi.main_py", "framework", "fastapi", "file", "basename", "main.py", "low", "Common Python application entrypoint is present."),
    signal("framework.fastapi.app_py", "framework", "fastapi", "file", "basename", "app.py", "low", "Common Python application module is present."),

    signal("package_manager.pnpm.lockfile", "package_manager", "pnpm", "lockfile", "basename", "pnpm-lock.yaml", "high", "pnpm lockfile is present."),
    signal("package_manager.npm.lockfile", "package_manager", "npm", "lockfile", "basename", "package-lock.json", "high", "npm lockfile is present."),
    signal("package_manager.yarn.lockfile", "package_manager", "yarn", "lockfile", "basename", "yarn.lock", "high", "Yarn lockfile is present."),
    signal("package_manager.composer.lockfile", "package_manager", "composer", "lockfile", "basename", "composer.lock", "high", "Composer lockfile is present."),
    signal("package_manager.pip.requirements", "package_manager", "pip", "manifest", "manifest_name", "requirements.txt", "medium", "pip requirements file is present."),
    signal("package_manager.uv.lockfile", "package_manager", "uv", "lockfile", "basename", "uv.lock", "high", "uv lockfile is present."),
    signal("package_manager.gomod.manifest", "package_manager", "gomod", "manifest", "manifest_name", "go.mod", "high", "Go module manifest is present."),
    signal("package_manager.cargo.lockfile", "package_manager", "cargo", "lockfile", "basename", "Cargo.lock", "high", "Cargo lockfile is present."),

    signal("runtime.node.package_json", "runtime", "node", "manifest", "manifest_name", "package.json", "high", "Node package manifest is present."),
    signal("runtime.node.nvmrc", "runtime", "node", "config", "basename", ".nvmrc", "high", "Node version file is present."),
    signal("runtime.node.dependency", "runtime", "node", "dependency", "dependency_name", "node", "medium", "Node runtime dependency marker is declared."),

    signal("runtime.php.composer_json", "runtime", "php", "manifest", "manifest_name", "composer.json", "high", "Composer manifest is present."),
    signal("runtime.php.php", "runtime", "php", "file", "extension", ".php", "low", "PHP files are present."),

    signal("runtime.python.pyproject", "runtime", "python", "manifest", "manifest_name", "pyproject.toml", "high", "Python project manifest is present."),
    signal("runtime.python.requirements", "runtime", "python", "manifest", "manifest_name", "requirements.txt", "medium", "Python requirements manifest is present."),
    signal("runtime.python.py", "runtime", "python", "file", "extension", ".py", "low", "Python files are present."),

    signal("runtime.go.go_mod", "runtime", "go", "manifest", "manifest_name", "go.mod", "high", "Go module manifest is present."),
    signal("runtime.rust.cargo_toml", "runtime", "rust", "manifest", "manifest_name", "Cargo.toml", "high", "Cargo manifest is present."),

    signal("infrastructure.docker.dockerfile", "infrastructure", "docker", "config", "basename", "Dockerfile", "high", "Dockerfile is present."),
    signal("infrastructure.docker.compose_yml", "infrastructure", "docker", "config", "basename", "docker-compose.yml", "high", "Docker Compose configuration is present."),
    signal("infrastructure.docker.compose_yaml", "infrastructure", "docker", "config", "basename", "docker-compose.yaml", "high", "Docker Compose configuration is present."),
    signal("infrastructure.github_actions.workflows", "infrastructure", "github_actions", "directory", "relative_path", ".github/workflows", "high", "GitHub Actions workflows directory is present."),
    signal("infrastructure.terraform.tf", "infrastructure", "terraform", "config", "extension", ".tf", "low", "Terraform configuration files are present."),
    signal("infrastructure.terraform.main_tf", "infrastructure", "terraform", "config", "basename", "main.tf", "high", "Conventional Terraform root module is present."),
    signal("infrastructure.terraform.variables_tf", "infrastructure", "terraform", "config", "basename", "variables.tf", "medium", "Conventional Terraform variables file is present."),

    signal("monorepo.pnpm.workspace", "monorepo", "pnpm_workspace", "config", "basename", "pnpm-workspace.yaml", "high", "pnpm workspace manifest is present."),
    signal("monorepo.npm.workspaces", "monorepo", "npm_workspaces", "manifest", "manifest_name", "package.json#workspaces", "medium", "package.json workspaces field is declared."),
    signal("monorepo.turbo.config", "monorepo", "npm_workspaces", "config", "basename", "turbo.json", "medium", "Turborepo configuration is present."),
    signal("monorepo.nx.config", "monorepo", "npm_workspaces", "config", "basename", "nx.json", "medium", "Nx workspace configuration is present."),
  ];

export function listProjectIntelligenceSignalDefinitions(): readonly ProjectIntelligenceSignalDefinition[] {
  return PROJECT_INTELLIGENCE_SIGNAL_DEFINITIONS;
}

export function getProjectIntelligenceSignalsByCategory(
  category: ProjectIntelligenceSignalCategory,
): readonly ProjectIntelligenceSignalDefinition[] {
  return PROJECT_INTELLIGENCE_SIGNAL_DEFINITIONS.filter(
    (definition) => definition.category === category,
  );
}

function signal(
  id: string,
  category: ProjectIntelligenceSignalCategory,
  target: ProjectIntelligenceSignalTarget,
  source: ProjectIntelligenceSignalSource,
  matchKind: ProjectIntelligenceSignalMatchKind,
  pattern: string,
  confidence: ProjectConfidence,
  reason: string,
): ProjectIntelligenceSignalDefinition {
  return {
    id,
    category,
    target,
    source,
    matchKind,
    pattern,
    confidence,
    reason,
  };
}
