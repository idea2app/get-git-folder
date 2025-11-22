#! /usr/bin/env node

import { Command } from 'commander-jsx';
import { $, cd, fs, os, path } from 'zx';

$.verbose = true;

async function downloadGitFolder(
    GitURL: string,
    branchName?: string,
    folderOrFilePath?: string
) {
    const tempFolder = path.join(os.tmpdir(), new URL(GitURL).pathname),
        targetFolder = process.cwd();

    await fs.remove(tempFolder);
    await fs.mkdirp(tempFolder);
    cd(tempFolder);

    if (folderOrFilePath) {
        await $`git init`;
        await $`git remote add origin ${GitURL}`;
        await $`git config core.sparseCheckout true`;
        await $`echo ${folderOrFilePath} > .git/info/sparse-checkout`;
        await $`git pull origin ${branchName}`;
    } else {
        await $`git clone ${GitURL} .`;
    }
    await $`git checkout ${branchName}`;

    await fs.remove(path.join(tempFolder, '.git'));

    const sourcePath = folderOrFilePath
        ? path.join(tempFolder, folderOrFilePath)
        : tempFolder;

    const sourceStat = await fs.stat(sourcePath);

    if (sourceStat.isFile()) {
        const fileName = path.basename(sourcePath);

        await fs.copy(sourcePath, path.join(targetFolder, fileName), {
            overwrite: true
        });
    } else await fs.copy(sourcePath, targetFolder, { overwrite: true });
}

async function listSubmodules() {
    await $`git submodule status`;

    console.log('Usage: xgit submodule remove <path>');
}

async function removeSubmodule(submodulePath: string) {
    try {
        await $`git config -f .gitmodules --remove-section submodule.${submodulePath}`;
        await $`git config -f .git/config --remove-section submodule.${submodulePath}`;
        await $`git add .gitmodules`;
        await $`git rm --cached ${submodulePath}`;
    } catch {}

    await fs.remove(submodulePath);
    await fs.remove(`.git/modules/${submodulePath}`);

    console.log(`
Successfully removed submodule: ${submodulePath}

Note: You may want to commit these changes with:

    git commit -m "Remove submodule ${submodulePath}"`);
}

async function uploadFolder(
    sourceFolder: string,
    GitURL: string,
    targetBranch: string
) {
    const originalCwd = process.cwd();
    const sourcePath = path.isAbsolute(sourceFolder)
        ? sourceFolder
        : path.join(originalCwd, sourceFolder);

    // Validate source folder exists
    if (!(await fs.pathExists(sourcePath))) {
        throw new Error(`Source folder does not exist: ${sourcePath}`);
    }

    const sourceStat = await fs.stat(sourcePath);
    if (!sourceStat.isDirectory()) {
        throw new Error(`Source path is not a directory: ${sourcePath}`);
    }

    try {
        cd(sourcePath);

        await $`git init`;

        // Check if remote already exists and update it
        try {
            await $`git remote get-url origin`;
            await $`git remote set-url origin ${GitURL}`;
        } catch {
            await $`git remote add origin ${GitURL}`;
        }

        await $`git checkout -b ${targetBranch}`;
        await $`git add .`;
        await $`git commit -m "upload by Git-utility CLI"`;
        await $`git push --set-upstream origin ${targetBranch} -f`;

        console.log(`
Successfully uploaded ${sourceFolder} to ${GitURL} on branch ${targetBranch}
Note: Changes were force pushed to the remote branch.`);
    } finally {
        cd(originalCwd);
    }
}

Command.execute(
    <Command name="xgit">
        <Command
            name="download"
            parameters="<GitURL> [branchName] [folderOrFilePath]"
            description="Download folders or files from a Git repository"
            executor={(
                _,
                GitURL: string,
                branchName = 'main',
                folderOrFilePath?: string
            ) =>
                downloadGitFolder(
                    GitURL,
                    branchName as string,
                    folderOrFilePath
                )
            }
        />
        <Command
            name="upload"
            parameters="<sourceFolder> <GitURL> <targetBranch>"
            description="Upload a folder to a Git repository"
            executor={(
                _,
                sourceFolder: string,
                GitURL: string,
                targetBranch: string
            ) => uploadFolder(sourceFolder, GitURL, targetBranch)}
        />
        <Command name="submodule" description="Manage Git submodules">
            <Command
                name="remove"
                parameters="[path]"
                description="Remove a Git submodule. If no path provided, lists current submodules."
                executor={(_, submodulePath?: string) =>
                    submodulePath
                        ? removeSubmodule(submodulePath)
                        : listSubmodules()
                }
            />
        </Command>
    </Command>,
    process.argv.slice(2)
);
