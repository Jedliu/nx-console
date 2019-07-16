const nps = require('nps-utils');
const os = require('os');
const { join } = require('path');

function forEachApplication(command) {
  return {
    electron: command.replace(/APPLICATION/g, 'electron'),
    intellij: command.replace(/APPLICATION/g, 'intellij'),
    vscode: command.replace(/APPLICATION/g, 'vscode')
  };
}

function affected(affectedCommand) {
  return {
    'origin-master': `nx affected:${affectedCommand} --base=origin/master --parallel`,
    'upstream-master': `nx affected:${affectedCommand} --base=upstream/master --parallel`
  };
}

function electronBuilder(platform, dashP, extraFlags) {
  return `electron-builder ${platform} -p ${dashP} ${
    extraFlags ? extraFlags : ''
  }`;
}

const ELECTRON_BUNDLE_PATH = join('dist', 'apps', 'electron');
const APPLICATION_BUNDLE_PATH = join('dist', 'apps', 'APPLICATION');

const assetMappings = {
  'extensions-schema': {
    from: join(
      './node_modules',
      '@nrwl',
      'angular-console-enterprise-electron',
      'schema.graphql'
    ),
    to: join(APPLICATION_BUNDLE_PATH, 'assets', 'extensions-schema.graphql')
  },
  'server-assets': {
    from: join('libs', 'server', 'src', 'assets', '*'),
    to: join(APPLICATION_BUNDLE_PATH, 'assets')
  },
  readme: {
    from: 'README.md',
    to: join(APPLICATION_BUNDLE_PATH, 'README.md')
  },
  schema: {
    from: join(
      'node_modules',
      '@nrwl',
      'angular-console-enterprise-electron',
      'schema.graphql'
    ),
    to: join(
      APPLICATION_BUNDLE_PATH,
      'assets',
      'angular-console-enterprise-electron-schema.graphql'
    )
  }
};

module.exports = {
  scripts: {
    dev: {
      'copy-assets': {
        electron: nps.series(
          'nps dev.copy-assets-base.electron',
          `shx chmod 0755 ${join(
            'dist',
            'apps',
            'electron',
            'assets',
            'new-workspace'
          )}`
        ),
        vscode: nps.series('nps dev.copy-assets-base.vscode')
      },
      'copy-assets-base': forEachApplication(
        nps.concurrent({
          schema: `shx cp ${assetMappings['schema'].from} ${
            assetMappings['schema'].to
          }`,
          'server-assets': `shx cp -rf ${assetMappings['server-assets'].from} ${
            assetMappings['server-assets'].to
          }`,
          readme: `shx cp ${assetMappings['readme'].from} ${
            assetMappings['readme'].to
          }`,
          'extensions-schema': `shx cp ${
            assetMappings['extensions-schema'].from
          } ${assetMappings['extensions-schema'].to}`,
          cli: 'node ./tools/scripts/patch-cli.js'
        })
      ),
      'gen-graphql': nps.series(
        'gql-gen --config ./tools/scripts/codegen-server.yml',
        'gql-gen --config ./tools/scripts/codegen-client.js'
      ),
      server: {
        default: nps.series(
          'nps dev.gen-graphql',
          'ng build electron --maxWorkers=2 --noSourceMap',
          'nps dev.copy-assets.electron',
          'nps dev.server.start'
        ),
        start: `electron ${ELECTRON_BUNDLE_PATH} --server --port 4201 --inspect=9229`
      },
      up: {
        default: nps.concurrent({
          server: 'nps dev.server',
          frontend: 'ng serve angular-console --configuration=dev'
        }),
        start: nps.concurrent({
          server: 'nps dev.server.start',
          frontend: 'ng serve angular-console --configuration=dev'
        }),
        cypress: nps.concurrent({
          server: 'nps dev.server.start',
          frontend: 'ng run angular-console:serve:cypress'
        })
      }
    },
    clean: 'shx rm -rf dist/',
    prepare: {
      and: {
        e2e: {
          up: nps.series.nps('prepare.e2e', 'e2e.up'),
          headless: nps.series.nps('prepare.e2e', 'e2e.headless')
        },
        package: {
          ...forEachApplication(
            nps.series.nps(
              'clean',
              'prepare.APPLICATION',
              'package.APPLICATION'
            )
          )
        }
      },
      e2e: {
        default: nps.concurrent.nps('prepare.electron', 'e2e.fixtures'),
        and: {
          'check-formatting': nps.concurrent.nps(
            'prepare.e2e',
            'format.and.lint.check'
          )
        }
      },
      ...forEachApplication(
        nps.series.nps(
          'build.APPLICATION',
          'install-dependencies.APPLICATION',
          'dev.copy-assets.APPLICATION'
        )
      ),
      dev: {
        ...forEachApplication(
          nps.series.nps(
            'build.APPLICATION.dev',
            'dev.copy-assets-base.APPLICATION'
          )
        )
      }
    },
    package: {
      electronMac: nps.series(
        'echo "${CSC_LINK:?Need to set CSC_LINK non-empty}" > /dev/null',
        electronBuilder('--mac', 'never'),
        electronBuilder('--linux', 'never')
      ),
      electronWin: nps.series(electronBuilder('--win', 'never')),
      vscode: nps.series(
        `shx rm -rf ${join('dist', 'apps', 'vscode', '**', '*-es5.js')}`,
        `shx rm -rf ${join('dist', 'apps', 'vscode', '**', '*.md')}`,
        `shx rm -rf ${join(
          'dist',
          'apps',
          'vscode',
          'assets',
          'public',
          'assets',
          'external-programs'
        )}`,

        `shx rm -rf ${join('dist', 'apps', 'vscode', '**', '*.ts')}`,

        `node ${join('tools', 'scripts', 'vscode-vsce.js')}`
      ),
      intellij: `node ${join('tools', 'scripts', 'intellij-package.js')}`
    },
    publish: {
      electronWin: nps.series(
        'nps prepare.electron',
        electronBuilder(
          '--win',
          'always',
          '--config.win.certificateSubjectName="Narwhal Technologies Inc."'
        )
      )
    },
    e2e: {
      fixtures: 'node ./tools/scripts/set-up-e2e-fixtures.js',
      up: 'node ./tools/scripts/e2e.js --watch',
      headless: {
        default: 'node ./tools/scripts/e2e.js --headless',
        'new-fixtures': nps.series.nps('prepare.e2e', 'e2e.headless')
      },
      ci1: 'node ./tools/scripts/e2e.js --headless --configuration=ci1',
      ci2: 'node ./tools/scripts/e2e.js --headless --configuration=ci2',
      ci3: 'node ./tools/scripts/e2e.js --headless --configuration=ci3'
    },
    format: {
      default: 'nx format:write',
      and: {
        lint: {
          check: nps.concurrent.nps('format.check', 'lint')
        }
      },
      write: 'nx format:write',
      check: 'nx format:check'
    },
    lint: {
      default: nps.concurrent({
        nxLint: 'nx lint',
        tsLint: 'npx tslint -p tsconfig.json -e **/generated/* -c tslint.json',
        stylelint: 'stylelint "{apps,libs}/**/*.scss" --config .stylelintrc'
      }),
      fix: nps.concurrent({
        tslint:
          'npx tslint -p tsconfig.json -e **/generated/* -c tslint.json --fix',
        stylelint:
          'stylelint "{apps,libs}/**/*.scss" --config .stylelintrc --fix'
      })
    },
    build: {
      default: 'nx affected:build --all --parallel',
      affected: affected('build'),
      ...forEachApplication(
        nps.series(
          'nps dev.gen-graphql',
          nps.concurrent({
            server: 'ng build APPLICATION --prod --maxWorkers=2 --noSourceMap',
            client: 'ng build angular-console --configuration=APPLICATION'
          })
        )
      ),
      dev: {
        ...forEachApplication(
          nps.series(
            'nps dev.gen-graphql',
            nps.concurrent({
              server: 'ng build APPLICATION --maxWorkers=2',
              client: 'ng build angular-console --configuration=APPLICATION'
            })
          )
        )
      }
    },
    test: {
      default: 'nx affected:test --all --parallel',
      affected: affected('test')
    },
    'install-dependencies': {
      vscode: ``,
      electron: `node ${join('tools', 'scripts', 'electron-yarn.js')}`,
      intellij: `node ${join('tools', 'scripts', 'intellij-yarn.js')}`
    }
  }
};
