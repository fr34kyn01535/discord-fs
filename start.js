#!/usr/bin/env node

require('ts-node').register({
    project: __dirname + "/start.tsconfig.json"
});
require('./index.ts');