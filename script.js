// --- НАЧАЛО: БЛОК CHAMELEON (ОТКАЗОУСТОЙЧИВАЯ ВЕРСИЯ) ---
/*--------------------------------------------*/
// Функция для однократной загрузки библиотеки Vibrant.js
const loadVibrantScript = () => {
    return new Promise((resolve, reject) => {
        // Если библиотека уже загружена, ничего не делаем
        if (window.Vibrant) return resolve();
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/node-vibrant@3.1.6/dist/vibrant.min.js';
        script.onload = () => { console.log('[Chameleon] Библиотека Vibrant.js успешно загружена.'); resolve(); };
        script.onerror = (e) => { console.error('[Chameleon] Не удалось загрузить Vibrant.js'); reject(e); };
        document.head.appendChild(script);
    });
};

const applyChameleonStyles = (palette) => {
    // Получаем цвета из ПОЛНОЦЕННОГО объекта палитры
    const vibrantColor = palette.Vibrant?.getHex() || palette.LightVibrant?.getHex() || '#8a63b3';
    const lightVibrantColor = palette.LightVibrant?.getHex() || palette.Vibrant?.getHex() || '#ffffff';
    const darkVibrantColor = palette.DarkVibrant?.getHex() || palette.DarkMuted?.getHex() || '#000';
    const lightMutedColor = palette.LightMuted?.getHex() || palette.Muted?.getHex() || '#b0b0b0';

    // Устанавливаем все цвета как CSS-переменные
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--accent-color', vibrantColor);
    rootStyle.setProperty('--light-vibrant-color', lightVibrantColor);
    rootStyle.setProperty('--dark-vibrant-color', darkVibrantColor);
    rootStyle.setProperty('--light-muted-color', lightMutedColor);

    rootStyle.setProperty('--ym-controls-color-secondary-text-enabled', darkVibrantColor, 'important');
    rootStyle.setProperty('--ym-controls-color-secondary-on_default-hovered', darkVibrantColor, 'important');
    rootStyle.setProperty('--ym-controls-color-secondary-on_default-enabled', darkVibrantColor, 'important');

    console.log('[Chameleon] CSS-переменные цвета обновлены.');
};

// Финальная версия главной функции с таймаутом
const updateChameleonColors = async (imageUrl) => {
    try {
        await loadVibrantScript();

        // Создаем "гонку": либо Vibrant.js успевает за 8 секунд, либо мы прерываем его
        const palette = await Promise.race([
            Vibrant.from(imageUrl).getPalette(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Vibrant.js timed out after 8 seconds')), 8000)
            )
        ]);

        console.log('[Chameleon] Палитра получена:', palette);
        applyChameleonStyles(palette);

    } catch (error) {
        console.error('[Chameleon] Ошибка в цепочке обновления цветов:', error.message);
    }
};
/*--------------------------------------------*/
// --- КОНЕЦ БЛОКА CHAMELEON ---


// Фоновая картинка с параллаксом (Версия 2, Двухслойная) (ИСПРАВЛЕНО)
/*--------------------------------------------*/
// --- НОВОЕ: Функция Debounce для предотвращения "дребезга" ---
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

// --- НОВОЕ: Функция Throttle для ограничения частоты вызовов ---
const throttle = (func, limit) => {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

let fallbackTimeoutId = null; 
let currentImgBackground = "";
let currentTrackTitle = ""; // НОВОЕ: Переменная для хранения названия трека
let bgLayer1, bgLayer2;
let activeLayer, inactiveLayer;

const parallaxIntensity = 25;

const handleParallax = (event) => {
    if (!bgLayer1 || !bgLayer2) return;
    const { clientX, clientY } = event;
    const { innerWidth, innerHeight } = window;
    const offsetX = (clientX / innerWidth) - 0.5;
    const offsetY = (clientY / innerHeight) - 0.5;
    const newX = `calc(50% + ${offsetX * parallaxIntensity}px)`;
    const newY = `calc(50% + ${offsetY * parallaxIntensity}px)`;
    requestAnimationFrame(() => {
        bgLayer1.style.backgroundPosition = `${newX} ${newY}`;
        bgLayer2.style.backgroundPosition = `${newX} ${newY}`;
    });
};

const createLayer = (zIndex) => {
    const layer = document.createElement('div');
    layer.style.position = 'fixed';
    layer.style.top = '-20px';
    layer.style.left = '-20px';
    layer.style.width = 'calc(100vw + 40px)';
    layer.style.height = 'calc(100vh + 40px)';
    layer.style.zIndex = zIndex;
    layer.style.backgroundSize = 'cover';
    layer.style.backgroundPosition = 'center center';
    layer.style.opacity = '0';
    layer.style.transition = 'opacity 1s ease, background-position 0.2s ease-out';
    layer.style.willChange = 'opacity, background-position, background-image';
    layer.style.filter = 'blur(3px) brightness(0.5)';
    document.body.appendChild(layer);
    return layer;
};

const initializeBackgroundLayers = () => {
    if (bgLayer1) return;

    bgLayer1 = createLayer('-2');
    bgLayer2 = createLayer('-3');
    
    activeLayer = bgLayer1;
    inactiveLayer = bgLayer2;

    window.addEventListener('mousemove', throttle(handleParallax, 33));
    
    // Загружаем Vibrant.js при первой инициализации, чтобы он был готов
    loadVibrantScript();

    console.log('[ChromaSync] Двухслойная система фона с параллаксом инициализирована.');
};

const updateBackgroundImage = (imgBackground) => {
    if (!activeLayer || inactiveLayer.style.backgroundImage.includes(imgBackground)) {
        return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous"; // <-- Важно для анализа картинки с другого домена
    img.src = imgBackground;

    img.onload = () => {
        inactiveLayer.style.backgroundImage = `url(${imgBackground})`;
        requestAnimationFrame(() => {
            inactiveLayer.style.opacity = '1';
        });
        setTimeout(() => {
            activeLayer.style.opacity = '0';
            const temp = activeLayer;
            activeLayer = inactiveLayer;
            inactiveLayer = temp;
        }, 500); // ИЗМЕНЕНО: Анимация ускорена с 1100 до 500 мс
        // Вызываем обновление цветов "Хамелеона" только после загрузки нового фона
        updateChameleonColors(imgBackground); 
    };
    img.onerror = () => {
        console.error('[ChromaSync] Не удалось загрузить изображение для фона:', imgBackground);
    };
};

const handleCoverChange = (coverElement) => {
    clearTimeout(fallbackTimeoutId); 

    // НОВОЕ: Получаем название трека
    const playerBar = coverElement.closest('[class*="PlayerBarDesktop_playerBar__"]');
    const titleElement = playerBar ? playerBar.querySelector('.Track_title__9u_DA') : null;
    const newTrackTitle = titleElement ? titleElement.textContent : null;

    const newSrc = coverElement.src;
    if (newSrc && newSrc.includes('/100x100')) {
        const newImgBackground = newSrc.replace('/100x100', '/1000x1000');
        
        // ИЗМЕНЕНО: Проверяем и обложку, и название трека
        if (newImgBackground !== currentImgBackground || (newTrackTitle && newTrackTitle !== currentTrackTitle)) {
            currentImgBackground = newImgBackground;
            currentTrackTitle = newTrackTitle; // Обновляем запомненное название

            initializeBackgroundLayers();
            updateBackgroundImage(newImgBackground);

            // УЛУЧШЕННЫЙ страховочный механизм
            fallbackTimeoutId = setTimeout(() => {
                const latestCoverElement = document.querySelector('[class*="PlayerBarDesktopWithBackgroundProgressBar_cover__MKmEt"]');
                if (latestCoverElement) {
                    const latestExpectedBg = latestCoverElement.src.replace('/100x100', '/1000x1000');
                    const currentAccentColor = document.documentElement.style.getPropertyValue('--accent-color');
                    
                    // Проверяем, что трек все еще тот же И (фон не обновился ИЛИ цвет не обновился)
                    if (latestExpectedBg === newImgBackground && 
                       (!activeLayer || !activeLayer.style.backgroundImage.includes(newImgBackground) || !currentAccentColor)) {
                         console.log('[ChromaSync] Страховочный механизм: Обнаружена рассинхронизация через 10 сек. Принудительное обновление...');
                         updateBackgroundImage(newImgBackground); // Перезапускаем всю цепочку
                    }
                }
            }, 10000);
        }
    }
};

// --- НОВОЕ: Создаем debounced-версию обработчика ---
const debouncedHandleCoverChange = debounce(handleCoverChange, 700);

// --- НАЧАЛО: Отказоустойчивый наблюдатель за обложкой ---

// WeakSet для отслеживания уже наблюдаемых элементов, чтобы избежать дублирования
// и утечек памяти (элемент автоматически удаляется из сета при удалении из DOM).
const observedCovers = new WeakSet();

// Эта функция будет вызываться для каждой найденной (и еще не наблюдаемой) обложки
const setupObserverForCover = (coverElement) => {
    if (observedCovers.has(coverElement)) {
        return; // Уже наблюдаем, ничего не делаем
    }

    console.log('[ChromaSync] Обнаружен новый элемент обложки. Начинаю наблюдение.');
    observedCovers.add(coverElement); // "Запоминаем" этот элемент

    // Запускаем обработку для текущей обложки
    // Если это первая загрузка, вызов будет немедленным, иначе - с задержкой
    if (document.readyState === 'loading') {
         handleCoverChange(coverElement);
    } else {
         debouncedHandleCoverChange(coverElement);
    }
    
    // Создаем персонального наблюдателя за атрибутом 'src'
    const attributeObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.attributeName === 'src') {
                debouncedHandleCoverChange(mutation.target);
            }
        });
    });
    attributeObserver.observe(coverElement, { attributes: true, attributeFilter: ['src'] });
};

// Главный, "неусыпный" наблюдатель, который ищет появление новых обложек в DOM
const mainCoverObserver = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.addedNodes) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType !== 1) return; // Пропускаем все, что не является элементом

                // Ищем обложку либо в самом добавленном узле, либо среди его детей
                const cover = node.matches('[class*="PlayerBarDesktopWithBackgroundProgressBar_cover__MKmEt"]')
                    ? node
                    : node.querySelector('[class*="PlayerBarDesktopWithBackgroundProgressBar_cover__MKmEt"]');
                
                if (cover) {
                    setupObserverForCover(cover);
                }
            });
        }
    }
});

// Сразу ищем обложку при запуске скрипта
const initialCover = document.querySelector('[class*="PlayerBarDesktopWithBackgroundProgressBar_cover__MKmEt"]');
if (initialCover) {
    setupObserverForCover(initialCover);
}

// Запускаем главный наблюдатель, который будет работать ПОСТОЯННО
mainCoverObserver.observe(document.body, { childList: true, subtree: true });

/*--------------------------------------------*/
// --- КОНЕЦ БЛОКА ФОНОВОЙ КАРТИНКИ ---

// Отключение тупого даблклика (ИСПРАВЛЕНО)
/*--------------------------------------------*/
const attachDoubleClickBlocker = (element) => {
    element.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
    }, { capture: true, once: true }); // Используем once: true, чтобы слушатель автоматически удалился после первого вызова, если нужно, но здесь важнее capture
    console.log('[ChromaSync] Блокировщик двойного клика установлен на PlayerBar.');
};

const dblClickObserver = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
        if (mutation.addedNodes) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) { // Убедимся, что это элемент
                    const playerBar = node.matches('.PlayerBar_root__cXUnU') ? node : node.querySelector('.PlayerBar_root__cXUnU');
                    if (playerBar) {
                        attachDoubleClickBlocker(playerBar);
                        // Как только нашли и обработали, можно перестать наблюдать.
                        // Это экономит ресурсы.
                        observer.disconnect(); 
                    }
                }
            });
        }
    }
});

// Пробуем найти элемент сразу. Если его нет, запускаем наблюдателя.
const initialPlayerBar = document.querySelector('.PlayerBar_root__cXUnU');
if (initialPlayerBar) {
    attachDoubleClickBlocker(initialPlayerBar);
} else {
    dblClickObserver.observe(document.body, { childList: true, subtree: true });
}
/*--------------------------------------------*/


// Авто смена темы Яндекс Музыки на тёмную (ИСПРАВЛЕНО)
/*--------------------------------------------*/
// Функция для принудительной установки темной темы
const forceDarkTheme = () => {
    const body = document.body;
    // Проверяем, если светлая тема активна, меняем ее на темную.
    if (body.classList.contains('ym-light-theme')) {
        body.classList.replace('ym-light-theme', 'ym-dark-theme');
    } 
    // Если вообще никакой темы нет, добавляем темную.
    else if (!body.classList.contains('ym-dark-theme') && !body.classList.contains('ym-light-theme')) {
        body.classList.add('ym-dark-theme');
    }
};

// Создаем наблюдателя, который следит за изменениями атрибута class у <body>
const themeObserver = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            // Если класс изменился, проверяем, не нужно ли снова включить темную тему
            forceDarkTheme();
        }
    }
});

// Начинаем наблюдение за <body>
themeObserver.observe(document.body, { attributes: true });

// Однократно вызываем функцию при запуске скрипта, чтобы установить тему сразу
forceDarkTheme();
/*--------------------------------------------*/


// МЕНЯЙТЕ ЦВЕТ!!!
/*--------------------------------------------*/
const css = `
:root {
    --background-color: #000;
}

.TrackLyricsModal_root__KsVRf,
.QualitySettingsModal_root__f3gE2,
.QualitySettingsContextMenu_root_withEqualizer__GPjIg,
.TrailerModal_modalContent__ZSNFe,
.TrackAboutModalDesktop_root_withWindows__jIOiB {
    background-color: var(--background-color);
}
`;

const style = document.createElement('style');
style.appendChild(document.createTextNode(css));
document.head.appendChild(style);

/*--------------------------------------------*/
// Функция для обновления CSS-переменной :root на основе цвета плеера
const updateRootBackgroundColor = (playerBar) => {
    const newColor = getComputedStyle(playerBar).getPropertyValue('--player-average-color-background').trim();
    if (newColor) {
        document.documentElement.style.setProperty('--background-color', newColor);
    }
};

// Наблюдатель за появлением плеера, чтобы затем следить за его стилем
const playerBarObserver = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && node.matches('section.PlayerBar_root__cXUnU')) {
                // Плеер найден. Запускаем обновление цвета и начинаем следить за его стилем.
                updateRootBackgroundColor(node);
                
                const styleObserver = new MutationObserver(() => updateRootBackgroundColor(node));
                styleObserver.observe(node, { attributes: true, attributeFilter: ['style'] });

                // Мы нашли плеер, больше нет нужды его искать.
                observer.disconnect();
                return;
            }
        }
    }
});

// Попробуем найти плеер сразу при загрузке
const initialPlayerBarElement = document.querySelector('section.PlayerBar_root__cXUnU');
if (initialPlayerBarElement) {
    // Если плеер уже есть, обновляем цвет и начинаем следить за стилем
    updateRootBackgroundColor(initialPlayerBarElement);
    const styleObserver = new MutationObserver(() => updateRootBackgroundColor(initialPlayerBarElement));
    styleObserver.observe(initialPlayerBarElement, { attributes: true, attributeFilter: ['style'] });
} else {
    // Если плеера нет, ждем его появления
    playerBarObserver.observe(document.body, { childList: true, subtree: true });
}
/*--------------------------------------------*/


/*Управление handleEvents.json*/
/*--------------------------------------------*/
let settings = {};
let lastAppliedSettings = {}; // НОВОЕ: для хранения последнего примененного состояния

function log(text) {
    console.log('[Customizable LOG]: ', text)
}

async function getSettings() {
    try {
        const response = await fetch("http://localhost:2007/get_handle?name=chromasync");
        if (!response.ok) throw new Error(`Ошибка сети: ${response.status}`);
        const data = await response.json();
        if (!data?.data?.sections) {
            console.warn("Структура данных не соответствует ожидаемой.");
            return {};
        }
        return Object.fromEntries(data.data.sections.map(({ title, items }) => [
            title,
            Object.fromEntries(items.map(item => [
                item.id,
                item.bool ?? item.input ?? Object.fromEntries(item.buttons?.map(b => [b.name, b.text]) || [])
            ]))
        ]));
    } catch (error) {
        console.error("Ошибка при получении данных:", error);
        return {};
    }
}

let settingsDelay = 1000;
let updateInterval;

async function setSettings(newSettings) {
    // Текст сверху
    const themeTitleTextElement = document.querySelector('body > div.PSBpanel > p');
    if (themeTitleTextElement && (Object.keys(settings).length === 0 || settings['Текст'].themeTitleText.text !== newSettings['Текст'].themeTitleText.text)) {
        themeTitleTextElement.textContent = newSettings['Текст'].themeTitleText.text || 'ChromaSync';
    }

    // globalPlayerColor
    const playerBarElement = document.querySelector('section.PlayerBar_root__cXUnU');
    let globalPlayerColor = '';
    
    if (playerBarElement) {
        globalPlayerColor = playerBarElement.style.getPropertyValue('--player-average-color-background').trim();
    }

    // --- ОПТИМИЗАЦИЯ ---
    // Проверяем, изменились ли настройки, влияющие на этот блок стилей
    const isFirstRun = !lastAppliedSettings.hasOwnProperty('Vibe-Block');
    const vibeBlockChanged = !isFirstRun && lastAppliedSettings['Vibe-Block'].toggleFullscreenVibeBlock !== newSettings['Vibe-Block'].toggleFullscreenVibeBlock;
    const logoColorSettingChanged = !isFirstRun && lastAppliedSettings['Logo'].toggleVariableNextLogoColor !== newSettings['Logo'].toggleVariableNextLogoColor;
    const playerColorChanged = lastAppliedSettings.globalPlayerColor !== globalPlayerColor;

    if (isFirstRun || vibeBlockChanged || logoColorSettingChanged || playerColorChanged) {
        // Комбинированный стиль
        let combinedStyle = document.getElementById('combined-style');
        if (!combinedStyle) {
            combinedStyle = document.createElement('style');
            combinedStyle.id = 'combined-style';
            document.head.appendChild(combinedStyle);
        }
        
        combinedStyle.textContent = `
            /*Фуллвайб*/
            .VibeBlock_root__z7LtR {
                min-height: ${newSettings['Vibe-Block'].toggleFullscreenVibeBlock ? '79.8vh' : '400px'} !important;
                max-height: ${newSettings['Vibe-Block'].toggleFullscreenVibeBlock ? '79.8vh' : '400px'} !important;
            }
            @media (min-width: 1079px) {
                .VibeBlock_root__z7LtR {
                    min-height: ${newSettings['Vibe-Block'].toggleFullscreenVibeBlock ? '84.2vh' : '400px'} !important;
                    max-height: ${newSettings['Vibe-Block'].toggleFullscreenVibeBlock ? '84.2vh' : '400px'} !important;
                }
            }

            /*Транслого*/
            .NavbarDesktop_logo__Z4jGx * {
                color: ${newSettings['Logo'].toggleVariableNextLogoColor ? globalPlayerColor : ''} !important;
                filter: brightness(${newSettings['Logo'].toggleVariableNextLogoColor ? '1.4' : '1.0'}) !important;
            }
        `;
        // Сохраняем новое состояние
        lastAppliedSettings['Vibe-Block'] = { ...newSettings['Vibe-Block'] };
        lastAppliedSettings['Logo'] = { ...newSettings['Logo'] };
        lastAppliedSettings.globalPlayerColor = globalPlayerColor;
    }


    // Open Blocker
    const modules = [
        "donations",
        "concerts",
        "userprofile",
        "trailers",
        "betabutton",
        "relevantnow",
        "artistrecommends",
    ];

    modules.forEach(module => {
        const settingKey = `OB${module.charAt(0) + module.slice(1)}`;
        const cssId = `openblocker-${module}`;
        const existingLink = document.getElementById(cssId);
        
        if (Object.keys(settings).length === 0 || settings['Open-Blocker'][settingKey] !== newSettings['Open-Blocker'][settingKey]) {
            if (newSettings['Open-Blocker'][settingKey]) {
                if (existingLink) {
                    existingLink.remove();
                }
            } else {
                if (!existingLink) {
                    fetch(`https://raw.githubusercontent.com/Open-Blocker-FYM/Open-Blocker/refs/heads/main/blocker-css/${module}.css`)
                        .then(response => response.text())
                        .then(css => {
                            const style = document.createElement("style");
                            style.id = cssId;
                            style.textContent = css;
                            document.head.appendChild(style);
                        })
                        .catch(error => console.error(`Ошибка загрузки CSS: ${module}`, error));
                }
            }
        }
    });

    // Auto Play
    if (newSettings['Developer'].devAutoPlayOnStart && !window.hasRun) {
        document.querySelector(`section.PlayerBar_root__cXUnU * [data-test-id="PLAY_BUTTON"]`)
        ?.click();
        window.hasRun = true;
    }

    // Update theme settings delay
    if (Object.keys(settings).length === 0 || settings['Особое'].setInterval.text !== newSettings['Особое'].setInterval.text) {
        const newDelay = parseInt(newSettings['Особое'].setInterval.text, 10) || 1000;
        if (settingsDelay !== newDelay) {
            settingsDelay = newDelay;

            // Обновление интервала
            clearInterval(updateInterval);
            updateInterval = setInterval(update, settingsDelay);
        }
    }
}

async function update() {
    const newSettings = await getSettings();
    if (newSettings && Object.keys(newSettings).length > 0) {
        await setSettings(newSettings);
        settings = newSettings; // `settings` по-прежнему хранит последнюю версию с сервера для сравнения
    }
}

function init() {
    update();
    updateInterval = setInterval(update, settingsDelay);
}

init();
/*--------------------------------------------*/


// --- НАЧАЛО: Синхронизация при восстановлении окна ---
const forceSyncOnVisibility = () => {
    // Небольшая задержка, чтобы дать интерфейсу Яндекса "прогрузиться" после разворачивания
    setTimeout(() => {
        console.log('[ChromaSync] Окно стало видимым. Запускаю принудительную синхронизацию...');
        const coverElement = document.querySelector('[class*="PlayerBarDesktopWithBackgroundProgressBar_cover__MKmEt"]');
        if (coverElement) {
            // ИЗМЕНЕНО: Просто сбрасываем состояние и вызываем обработчик.
            // Это гарантирует, что он перечитает всё с нуля.
            currentImgBackground = ""; 
            currentTrackTitle = "";
            handleCoverChange(coverElement);
        }
    }, 1200); // 1.5-секундная задержка
};

// "Слушаем" событие, когда пользователь возвращается на вкладку
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        forceSyncOnVisibility();
    }
});
// --- КОНЕЦ: Синхронизация при восстановлении окна ---