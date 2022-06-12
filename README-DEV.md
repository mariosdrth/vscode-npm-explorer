# Npm Explorer

## Build and Run Project Locally

- Add a launch configuration under .vscode/launch.json as seen here (Run Extension configuration): [launch.json](/dev-resources/launch.json)
- The extension will be build as in the prod version under out/ folder and the watch npm task will run watching for changes. For changes to be applied the extension needs to be reloaded (default keybinding: Ctrl + Shift + F5)

## Build Prod and Publish
- ``npm run package`` builds the prod version and creates a .vsix file under the root folder This can be installed locally for testing
- ``vsce publish`` publishes in to Marketplace (vsce needs to be installed first: ``npm i -g vsce``)

## Setup and Run UI Tests
- ``npm run ui-tests-setup`` will install the vscode portal version under test-resources/ for testing plus all the necessary dependencies (including our extension)
- ``npm run ui-tests-build`` will compile the extension and copy the test files and resources under out/ folder
- ``npm run ui-tests-run`` will run all the tests
- ``npm run ui-tests`` will perform all the above steps in the appropriate order (for dev purposes though it's not necessary to re-setup everything unless the extension itself is modified)

# Debug UI Tests
- Run ``npm run ui-tests-setup`` if necessary (see above)
- Add a launch configuration under .vscode/launch.json as seen here (Debug UI Tests): [launch.json](/dev-resources/launch.json)
- Debug through vscode by running the Debug UI Tests configuration (or press F5)