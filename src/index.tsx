#! /usr/bin/env node

import { Command } from 'commander-jsx';
import { $, cd, fs, os, path } from 'zx';

$.verbose = true;

async function downloadGitFolder(
    GitURL: string,
    branchName?: string,
    folderOrFilePath?: string,
    localPath?: string
) {
    const tempFolder = path.join(os.tmpdir(), new URL(GitURL).pathname),
        targetFolder = localPath || process.cwd();

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
    targetBranch: string,
    targetFolder?: string
) {
    if (targetFolder) {
        const tempFolder = path.join(os.tmpdir(), new URL(GitURL).pathname);

        await fs.remove(tempFolder);
        await fs.mkdirp(tempFolder);
        cd(tempFolder);

        await $`git clone -b ${targetBranch} ${GitURL} .`;

        await fs.remove(path.join(tempFolder, targetFolder));
        await fs.copy(sourceFolder, path.join(tempFolder, targetFolder));

        await $`git add .`;
        await $`git commit -m "upload by Git-utility CLI"`;
        await $`git push origin ${targetBranch}`;
    } else {
        cd(sourceFolder);

        await $`git init`;
        await $`git remote add origin ${GitURL}`;
        await $`git checkout -b ${targetBranch}`;
        await $`git add .`;
        await $`git commit -m "upload by Git-utility CLI"`;
        await $`git push --set-upstream origin ${targetBranch} -f`;
    }
}

Command.execute(
    <Command name="xgit">
        <Command
            name="download"
            parameters="<GitURL> [branchName] [folderOrFilePath] [localPath]"
            description="Download folders or files from a Git repository"
            executor={(
                _,
                GitURL: string,
                branchName = 'main',
                folderOrFilePath?: string,
                localPath?: string
            ) =>
                downloadGitFolder(
                    GitURL,
                    branchName as string,
                    folderOrFilePath,
                    localPath
                )
            }
        />
        <Command
            name="upload"
            parameters="<sourceFolder> <GitURL> <targetBranch> [targetFolder]"
            description="Upload a folder to a Git repository"
            executor={(
                _,
                sourceFolder: string,
                GitURL: string,
                targetBranch: string,
                targetFolder?: string
            ) => uploadFolder(sourceFolder, GitURL, targetBranch, targetFolder)}
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
