(function () {
    const vscode = acquireVsCodeApi();
    const versionSelectOption = document.getElementById('version');
    const installBtn = document.getElementById('install-btn');
    const installBtnDep = document.getElementById('install-btn-dep');
    const installBtnDevDep = document.getElementById('install-btn-dev-dep');
    const loaderWrapper = document.getElementById('loader-wrapper');
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search');
    const weeklyDownloadsPlot = document.getElementById('weekly-downloads-plot');
    const weeklyDownloadsHeader = document.getElementById('weekly-downloads-week');
    const weeklyDownloads = document.getElementById('weekly-downloads');
    const wantedVersion = document.getElementById('content-info-wanted-version');
    const searchResults = document.getElementsByClassName('result-list-item-btn');

    let weeklyDownloadsInitialValue;

    window.onload = () => {
        if (searchInput) {
            searchInput.focus();
        }
        if (searchInput.value) {
            searchInput.select();
        }
    };

    weeklyDownloadsPlot && weeklyDownloadsPlot.addEventListener('mouseleave', () => {
        weeklyDownloadsHeader.innerText = 'Weekly Downloads:';
        weeklyDownloads.innerText = weeklyDownloadsInitialValue;
    });

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
            case 'buildGraph':
                weeklyDownloadsInitialValue = message.initialDownloadValue;
                loadGraph(message.xValues, message.yValues);
                break;
        }
    });
}());

function loadGraph(xValues, yValues) {
    createGraphType();
    
    const ctx = document.getElementById("weekly-downloads-plot").getContext("2d");
    const chart = new Chart(ctx, {
        type: "lineWithHoverIndicator",
        data: {
            labels: xValues,
            datasets: [
                {
                    fill: true,
                    lineTension: 0,
                    borderWidth: 5,
                    borderColor: "#8956FF",
                    pointBackgroundColor: "#8956FF",
                    backgroundColor: "rgba(94, 26, 255, 0.1)",
                    data: yValues,
                    xValues: xValues,
                    pointRadius: 0,
                    hoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            tooltips: {
                callbacks: {
                    title: function(tooltipItem, data) {
                        return data['labels'][tooltipItem[0]['index']];
                    },
                    label: function(tooltipItem, data) {
                        return data['datasets'][0]['data'][tooltipItem['index']].toLocaleString('en-US');
                    }
                },
                displayColors: false,
                mode: 'index',
                intersect: false
            },
            hover: {
                mode: 'index',
                intersect: false
            },
            legend: {display: false},
            scales: {
                yAxes: [
                    {
                        display: false,
                        ticks: {
                            suggestedMin: 50,
                            suggestedMax: 100
                        }
                    }
                ],
                xAxes: [
                    {
                        ticks: {
                            display: false
                        },
                        gridLines: {
                            display:false
                        }
                    }
                ]
            },
            layout: {
                padding: {
                    left: 10,
                    right: 10,
                    top: 10
                }
            },
            onHover: (e) => {
                const item = chart.getElementsAtXAxis(e);
                if (!item || item.length === 0) {
                    return;
                }
                const index = item[0]._index;
                const weeklyDownloadsHeader = document.getElementById('weekly-downloads-week');
                const weeklyDownloads = document.getElementById('weekly-downloads');

                if (!weeklyDownloads || !weeklyDownloadsHeader) {
                    return;
                }

                weeklyDownloadsHeader.innerText = chart.data.datasets[0].xValues[index] + ':';
                weeklyDownloads.innerText = chart.data.datasets[0].data[index].toLocaleString('en-US');
            }
        }
    });
}

function createGraphType() {
    Chart.defaults.lineWithHoverIndicator = Chart.defaults.line;
    Chart.controllers.lineWithHoverIndicator = Chart.controllers.line.extend({
        draw: function(ease) {
            Chart.controllers.line.prototype.draw.call(this, ease);

            if (this.chart.tooltip._active && this.chart.tooltip._active.length) {
                const activePoint = this.chart.tooltip._active[0];
                ctx = this.chart.ctx;
                x = activePoint.tooltipPosition().x;
                topY = this.chart.scales['y-axis-0'].top;
                bottomY = this.chart.scales['y-axis-0'].bottom;

                ctx.save();
                ctx.beginPath();
                ctx.moveTo(x, topY);
                ctx.lineTo(x, bottomY);
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#8956FF';
                ctx.stroke();
                ctx.restore();
            }
        }
    });
}