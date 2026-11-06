const { withProjectBuildGradle } = require('expo/config-plugins');

// React Native 0.81 ships Fresco 3.6.0, whose AbstractDraweeController reads an
// image's info after the image reference may already be closed. That throws
// IllegalStateException on the main thread and closes the app (Play Console:
// Preconditions.checkState <- PipelineDraweeController.getImageInfo <-
// reportSuccess). Fresco 3.7.0 fixes it (facebook/fresco#2839), so every Fresco
// artifact is held to that version. Remove this once React Native ships 3.7.0+.
const FRESCO_VERSION = '3.7.0';
const MARKER = '// with-fresco-fix';

const BLOCK = `
${MARKER}
allprojects {
    configurations.configureEach {
        resolutionStrategy.eachDependency { details ->
            if (details.requested.group == 'com.facebook.fresco') {
                details.useVersion('${FRESCO_VERSION}')
            }
        }
    }
}
`;

function addFrescoFix(contents) {
  return contents.includes(MARKER) ? contents : contents + BLOCK;
}

module.exports = (config) =>
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-fresco-fix: expected a Groovy android/build.gradle');
    }
    cfg.modResults.contents = addFrescoFix(cfg.modResults.contents);
    return cfg;
  });

module.exports.addFrescoFix = addFrescoFix;
