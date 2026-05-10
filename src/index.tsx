#! /usr/bin/env node

import { Command } from 'commander-jsx';
import { $, cd, fs, os, path } from 'zx';

$.verbose = true;

async function downloadGitFolder(
    GitURL: string,
    branchName?: string,
    folderOrFilePath?: string,
    targetFolder = '.'
) {
    targetFolder = path.resolve(targetFolder);

    const tempFolder = path.join(os.tmpdir(), new URL(GitURL).pathname);

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

        await fs.copy(sourcePath, path.join(targetFolder, fileName));
    } else await fs.copy(sourcePath, targetFolder);
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
    targetFolder?: string,
    message = 'upload by Git-utility CLI',
    force = false
) {
    sourceFolder = path.resolve(sourceFolder);

    if (targetFolder) {
        const tempFolder = path.join(os.tmpdir(), new URL(GitURL).pathname);

        await fs.remove(tempFolder);
        await fs.mkdirp(tempFolder);
        cd(tempFolder);

        await $`git clone -b ${targetBranch} ${GitURL} .`;

        targetFolder = path.join(tempFolder, targetFolder);

        await fs.mkdirp(targetFolder);

        for (const entry of await fs.readdir(sourceFolder))
            if (entry !== '.git')
                await fs.copy(
                    path.join(sourceFolder, entry),
                    path.join(targetFolder, entry),
                    {
                        overwrite: true
                    }
                );

        await $`git add .`;
        await $`git commit -m ${message}`;
        await $`git push origin ${targetBranch}`;
    } else if (force) {
        cd(sourceFolder);

        await $`git init`;
        await $`git remote add origin ${GitURL}`;
        await $`git checkout -b ${targetBranch}`;
        await $`git add .`;
        await $`git commit -m ${message}`;
        await $`git push --set-upstream origin ${targetBranch} -f`;
        await fs.remove('.git');
    } else {
        const tempFolder = path.join(os.tmpdir(), new URL(GitURL).pathname);

        await fs.remove(tempFolder);
        await fs.mkdirp(tempFolder);
        cd(tempFolder);

        await $`git clone -b ${targetBranch} ${GitURL} .`;

        for (const entry of await fs.readdir(sourceFolder))
            if (entry !== '.git')
                await fs.copy(
                    path.join(sourceFolder, entry),
                    path.join(tempFolder, entry),
                    {
                        overwrite: true
                    }
                );

        await $`git add .`;
        await $`git commit -m ${message}`;
        await $`git push origin ${targetBranch}`;
    }
}

Command.execute(
    <Command name="xgit">
        <Command
            name="download"
            parameters="<GitURL> [branchName] [folderOrFilePath] [targetFolder]"
            description="Download folders or files from a Git repository"
            executor={(
                _,
                GitURL: string,
                branchName = 'main',
                folderOrFilePath?: string,
                targetFolder?: string
            ) =>
                downloadGitFolder(
                    GitURL,
                    branchName as string,
                    folderOrFilePath,
                    targetFolder
                )
            }
        />
        <Command
            name="upload"
            parameters="<sourceFolder> <GitURL> <targetBranch> [targetFolder]"
            description="Upload a folder to a Git repository"
            options={{
                message: {
                    shortcut: 'm',
                    parameters: '<message>',
                    description: 'Custom commit message'
                },
                force: {
                    shortcut: 'f',
                    description:
                        'Discard Git history and force-push source folder'
                }
            }}
            executor={(
                options,
                sourceFolder: string,
                GitURL: string,
                targetBranch: string,
                targetFolder?: string
            ) => {
                const message =
                    typeof options.message === 'string'
                        ? options.message
                        : undefined;

                return uploadFolder(
                    sourceFolder,
                    GitURL,
                    targetBranch,
                    targetFolder,
                    message,
                    options.force === true
                );
            }}
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
