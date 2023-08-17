#! /usr/bin/env node

import { Command, createCommand } from 'commander-jsx';
import { $, cd, fs, os, path } from 'zx';

async function main(GitURL: string, branchName?: string, folderPath?: string) {
    const tempFolder = path.join(os.tmpdir(), new URL(GitURL).pathname),
        targetFolder = process.cwd();

    await fs.remove(tempFolder);
    await fs.mkdirp(tempFolder);
    cd(tempFolder);

    if (folderPath) {
        await $`git init`;
        await $`git remote add origin ${GitURL}`;
        await $`git config core.sparseCheckout true`;
        await $`echo ${folderPath} > .git/info/sparse-checkout`;
        await $`git pull origin ${branchName}`;
    } else {
        await $`git clone ${GitURL} .`;
    }
    await $`git checkout ${branchName}`;

    await fs.remove(path.join(tempFolder, '.git'));
    await fs.copy(
        folderPath ? path.join(tempFolder, folderPath) : tempFolder,
        targetFolder,
        { overwrite: true }
    );
}

Command.execute(
    <Command
        parameters="<GitURL> [branchName] [folderPath]"
        executor={(
            _,
            GitURL: string,
            branchName = 'main',
            folderPath?: string
        ) => main(GitURL, branchName as string, folderPath)}
    />,
    process.argv.slice(2)
);
