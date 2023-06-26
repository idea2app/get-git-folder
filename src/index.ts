#! /usr/bin/env node

import { $, argv, cd, fs, os, path } from 'zx';

const [GitURL, branchName = 'main', folderPath] = argv._;

const tempFolder = path.join(os.tmpdir(), new URL(GitURL).pathname),
    targetFolder = process.cwd();

await fs.remove(tempFolder);
await $`mkdir -p ${tempFolder}`;
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
