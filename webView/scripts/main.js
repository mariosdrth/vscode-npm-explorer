(function () {
    const vscode = acquireVsCodeApi();
    const versionSelectOption = document.getElementById('version');
    const installedVersion = document.getElementById('content-info-installed-version');
    const installBtn = document.getElementById('install-btn');
    const installBtnDep = document.getElementById('install-btn-dep');
    const installBtnDevDep = document.getElementById('install-btn-dev-dep');
    const loaderWrapper = document.getElementById('loader-wrapper');
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search');
    const wantedVersion = document.getElementById('content-info-wanted-version');
    const searchResults = document.getElementsByClassName('result-list-item-btn');

    window.onload = () => {
        if (searchInput) {
            searchInput.focus();
        }
        if (searchInput.value) {
            searchInput.select();
        }
    };

    installBtn && installBtn.addEventListener('click', () => {
        vscode.postMessage({command: 'installVersion', version: versionSelectOption.value});
    });

    installBtnDep && installBtnDep.addEventListener('click', () => {
        vscode.postMessage({command: 'installVersionForNewPackage', version: versionSelectOption.value, isDev: false});
    });

    installBtnDevDep && installBtnDevDep.addEventListener('click', () => {
        vscode.postMessage({command: 'installVersionForNewPackage', version: versionSelectOption.value, isDev: true});
    });


    searchBtn && searchBtn.addEventListener('click', () => {
        if (!searchInput) {
            return;
        }
        vscode.postMessage({command: 'search', searchtext: searchInput.value});
    });

    searchInput && searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            vscode.postMessage({command: 'search', searchtext: searchInput.value});
        }
    });

    searchResults && Array.from(searchResults).forEach(btn => {
        btn.addEventListener('click', () => {
            vscode.postMessage({command: 'searchResultSelected', packageName: btn.getElementsByClassName('result-list-item-header')[0].innerText});
        });
    });

    wantedVersion && wantedVersion.addEventListener('click', (e) => {
        const version = e.target.innerText;
        if (version && versionSelectOption) {
            versionSelectOption.value = version;
        }
    });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'showLoading':
                loaderWrapper && loaderWrapper.classList.add('visible');
                loaderWrapper && loaderWrapper.classList.remove('invisible');
                break;
            case 'hideLoading':
                loaderWrapper && loaderWrapper.classList.add('invisible');
                loaderWrapper && loaderWrapper.classList.remove('visible');
                break;
            case 'updateVersion':
                installedVersion && (installedVersion.innerText = `Version (${message.newVersion ? message.newVersion : ''}) installed${message.isDev ? ' as dev dependency' : ''}`);
                if (wantedVersion) {
                    if (message.wantedVersion === message.newVersion) {
                        wantedVersion.remove();
                    } else {
                        wantedVersion.innerHTML = `Wanted version (as derived from package.json): <a href="">${message.wantedVersion}</a>`;
                    }
                }
                break;
            case 'updateVersionSelectOptionClass':
                versionSelectOption && (Array.from(versionSelectOption.getElementsByClassName('version-select-option')).forEach(el => {
                    if (message.isDark) {
                        el.classList.add('version-select-option-dark');
                        el.classList.remove('version-select-option-light');
                    } else {
                        el.classList.add('version-select-option-light');
                        el.classList.remove('version-select-option-dark');
                    }
                }));
                break;
        }
    });
}());
