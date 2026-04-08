let isUpdating = false/**
 * @file ChromaSync Theme Script
 * @description Этот скрипт управляет всей динамической функциональностью темы ChromaSync:
 *              - Извлекает цвета из обложек треков.
 *              - Управляет фоновым изображением и его эффектами.
 *              - Применяет пользовательские настройки из handleEvents.json.
 *              - Оптимизирует производительность и исправляет различные баги интерфейса.
 */

/* --- Блок 1: Извлечение цвета из обложки (Vibrant.js) --- */

// Глобальная переменная для хранения последней извлеченной палитры.
let lastPalette = null

/**
 * Асинхронно загружает библиотеку Vibrant.js с CDN, если она еще не загружена.
 * @returns {Promise<void>} Promise, который разрешается после загрузки скрипта.
 */
const loadVibrantScript = () => {
    return new Promise((resolve, reject) => {
        if (window.Vibrant) return resolve()
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/node-vibrant@3.1.6/dist/vibrant.min.js'
        script.onload = () => {
            console.log('[ChromaSync] Библиотека Vibrant.js успешно загружена.')
            resolve()
        }
        script.onerror = e => {
            console.error('[ChromaSync] Не удалось загрузить Vibrant.js', e)
            reject(e)
        }
        document.head.appendChild(script)
    })
}

/**
 * Применяет извлеченные или заданные вручную цвета к CSS-переменным.
 * Также управляет цветом текста на табах для лучшей читаемости.
 * @param {object} palette - Палитра цветов, полученная от Vibrant.js.
 * @param {string} sourceChoice - Выбор пользователя, какой цвет из палитры использовать (e.g., 'Vibrant', 'Muted').
 */
const applyChameleonStyles = (palette, sourceChoice) => {
    // Если включен ручной режим, используем цвет из настроек и выходим.
    if (settings.useCustomAccentColor?.value) {
        const customColor = settings.customAccentColor?.value || '#8a63b3'
        document.documentElement.style.setProperty('--accent-color', customColor)
        console.log(`[ChromaSync] Установлен ручной акцентный цвет: ${customColor}`)
        return
    }

    if (!palette) {
        console.warn('[ChromaSync] Палитра не доступна (ручной режим выключен). Применение цвета отложено.')
        return
    }

    // Логика выбора основного акцентного цвета с резервными вариантами.
    const finalSourceChoice = sourceChoice || 'Vibrant'
    const fallbackSources = ['Vibrant', 'LightVibrant', 'DarkVibrant', 'Muted', 'LightMuted', 'DarkMuted']
    let accentSwatch = palette[finalSourceChoice]
    if (!accentSwatch) {
        for (const source of fallbackSources) {
            if (palette[source]) {
                accentSwatch = palette[source]
                console.warn(`[ChromaSync] Цвет '${finalSourceChoice}' не найден. Использован резервный: '${source}'.`)
                break
            }
        }
    }

    if (!accentSwatch) {
        console.error('[ChromaSync] В палитре не найдено подходящих цветов.')
        return
    }

    // Установка CSS-переменных на основе палитры.
    const vibrantColor = accentSwatch.getHex()
    const lightVibrantColor = palette.LightVibrant?.getHex() || palette.Vibrant?.getHex() || '#ffffff'
    const darkVibrantColor = palette.DarkVibrant?.getHex() || palette.DarkMuted?.getHex() || '#000'
    const lightMutedColor = palette.LightMuted?.getHex() || palette.Muted?.getHex() || '#b0b0b0'

    const rootStyle = document.documentElement.style
    rootStyle.setProperty('--accent-color', vibrantColor)
    rootStyle.setProperty('--light-vibrant-color', lightVibrantColor)
    rootStyle.setProperty('--dark-vibrant-color', darkVibrantColor)
    rootStyle.setProperty('--light-muted-color', lightMutedColor)
    rootStyle.setProperty('--ym-controls-color-secondary-text-enabled', darkVibrantColor, 'important')
    rootStyle.setProperty('--ym-controls-color-secondary-on_default-hovered', darkVibrantColor, 'important')
    rootStyle.setProperty('--ym-controls-color-secondary-on_default-enabled', darkVibrantColor, 'important')

    console.log(`[ChromaSync] Акцентный цвет ('${finalSourceChoice}') и CSS-переменные обновлены.`)

    // Динамический подбор цвета текста на табах для контрастности.
    const luminance = getLuminance(vibrantColor)
    const tabTextColor = luminance > 0.7 ? '#000000' : '#FFFFFF'
    let tabStyleElement = document.getElementById('dynamic-tab-color-style')
    if (!tabStyleElement) {
        tabStyleElement = document.createElement('style')
        tabStyleElement.id = 'dynamic-tab-color-style'
        document.head.appendChild(tabStyleElement)
    }
    tabStyleElement.textContent = `
        .Tab_title__hAYZk { color: ${tabTextColor} !important; }
    `
    console.log(`[ChromaSync] Яркость акцента: ${luminance.toFixed(2)}. Цвет текста табов: ${tabTextColor}`)
}

/**
 * Главная функция для обновления цветов темы. Загружает Vibrant.js,
 * получает палитру и вызывает applyChameleonStyles.
 * @param {string} imageUrl - URL обложки для анализа.
 */
const updateChameleonColors = async imageUrl => {
    try {
        await loadVibrantScript()
        // Устанавливаем таймаут на случай, если Vibrant.js "зависнет".
        const palette = await Promise.race([
            Vibrant.from(imageUrl).getPalette(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Vibrant.js timed out after 8 seconds')), 8000)),
        ])
        console.log('[ChromaSync] Палитра получена:', palette)
        lastPalette = palette
        applyChameleonStyles(palette, settings.accentColorSource?.value)
    } catch (error) {
        console.error('[ChromaSync] Ошибка в цепочке обновления цветов:', error.message)
    }
}

/* --- Блок 2: Вспомогательные утилиты --- */

/**
 * Создает debounced-версию функции, которая откладывает свой вызов
 * до тех пор, пока не пройдет `delay` миллисекунд без вызовов.
 * Полезно для ресурсоемких операций, запускаемых по частым событиям.
 * @param {Function} func - Исходная функция.
 * @param {number} delay - Задержка в миллисекундах.
 * @returns {Function} Debounced-версия функции.
 */
const debounce = (func, delay) => {
    let timeoutId
    return (...args) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
            func.apply(this, args)
        }, delay)
    }
}

/**
 * Вычисляет воспринимаемую яркость HEX-цвета (от 0 до 1).
 * @param {string} hex - Цвет в формате HEX (e.g., '#RRGGBB').
 * @returns {number} Значение яркости.
 */
const getLuminance = hex => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    if (!result) return 0
    const r = parseInt(result[1], 16)
    const g = parseInt(result[2], 16)
    const b = parseInt(result[3], 16)
    // Стандартная формула для расчета яркости.
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/**
 * Ограничивает частоту вызовов функции до одного раза в `limit` миллисекунд.
 * Полезно для обработки событий, которые срабатыют слишком часто (например, mousemove).
 * @param {Function} func - Исходная функция.
 * @param {number} limit - Интервал ограничения в миллисекундах.
 * @returns {Function} Throttled-версия функции.
 */
const throttle = (func, limit) => {
    let inThrottle
    return function () {
        const args = arguments
        const context = this
        if (!inThrottle) {
            func.apply(context, args)
            inThrottle = true
            setTimeout(() => (inThrottle = false), limit)
        }
    }
}

/* --- Блок 3: Управление фоном (обложка, параллакс) --- */

let bgLayer1, bgLayer2
let activeLayer, inactiveLayer
const parallaxIntensity = 25 // Интенсивность эффекта параллакса.

/**
 * Обрабатывает движение мыши для создания эффекта параллакса на фоне.
 * @param {MouseEvent} event - Событие движения мыши.
 */
const handleParallax = event => {
    if (!bgLayer1 || !bgLayer2) return
    const { clientX, clientY } = event
    const { innerWidth, innerHeight } = window
    const offsetX = clientX / innerWidth - 0.5
    const offsetY = clientY / innerHeight - 0.5
    const newX = `calc(50% + ${offsetX * parallaxIntensity}px)`
    const newY = `calc(50% + ${offsetY * parallaxIntensity}px)`
    requestAnimationFrame(() => {
        bgLayer1.style.backgroundPosition = `${newX} ${newY}`
        bgLayer2.style.backgroundPosition = `${newX} ${newY}`
    })
}

/**
 * Создает один из слоев для фона.
 * @param {string} zIndex - z-index для создаваемого слоя.
 * @returns {HTMLElement} Созданный div-элемент.
 */
const createLayer = zIndex => {
    const layer = document.createElement('div')
    layer.classList.add('body-background')
    layer.style.position = 'fixed'
    layer.style.top = '-20px'
    layer.style.left = '-20px'
    layer.style.width = 'calc(100vw + 40px)'
    layer.style.height = 'calc(100vh + 40px)'
    layer.style.zIndex = zIndex
    layer.style.backgroundSize = 'cover'
    layer.style.backgroundPosition = 'center center'
    layer.style.opacity = '0'
    layer.style.transition = 'opacity 0.6s ease, background-position 0.16s ease-out, transform 0.08s ease-out'
    layer.style.willChange = 'opacity, background-position, background-image, filter'
    const brightnessValue = settings.backgroundBrightness?.value ?? 0.5
    layer.style.filter = `blur(3px) brightness(${brightnessValue})`
    document.body.appendChild(layer)
    return layer
}

/* --- Блок 4: Эффект пульсации — удалён в Lite версии --- */

/**
 * Отправляет обновление настройки на сервер PulseSync.
 * ПРЕДПОЛОЖЕНИЕ: Формат тела запроса - { "id": "settingId", "value": "newValue" }.
 * Этот формат может потребовать корректировки.
 * @param {string} settingId - ID настройки из handleEvents.json.
 * @param {*} value - Новое значение настройки.
 */
const updateSettingOnServer = async (settingId, value) => {
    console.log(`[ChromaSync] Попытка обновить настройку '${settingId}' на сервере...`);
    try {
        const response = await fetch('http://localhost:2007/update_handle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: settingId, value: value })
        });

        if (response.ok) {
            console.log(`[ChromaSync] Настройка '${settingId}' успешно обновлена на сервере.`);
            // Немедленно запрашиваем свежие настройки для синхронизации.
            getSettings();
        } else {
            console.error(`[ChromaSync] Ошибка обновления настройки на сервере. Статус: ${response.status}`);
        }
    } catch (error) {
        console.error('[ChromaSync] Сетевая ошибка при обновлении настройки:', error);
    }
};

function createZenModeButton() {
    const anchorContainer = document.querySelector('div[class*="CommonLayout_root__WC_W1"]');

    if (!anchorContainer) {
        // Если контейнера нет на текущей "странице", просто выходим.
        // Наблюдатель вызовет функцию снова при следующей навигации.
        return;
    }

    // Проверяем, не создана ли кнопка ранее, чтобы избежать дубликатов.
    if (document.getElementById('zenModeButton')) {
        return;
    }

    // Все остальное - ваш код, один в один.
    anchorContainer.style.position = 'relative';

    const zenButton = document.createElement('button');
    zenButton.id = 'zenModeButton';
    zenButton.className = 'zen-mode-button';
    zenButton.innerHTML = '☯';
    zenButton.setAttribute('data-tooltip', 'Zen Mode');
    zenButton.onclick = () => {
        document.body.classList.toggle('zen-mode-active');
    };

    zenButton.style.position = 'absolute';
    zenButton.style.bottom = '3px';
    zenButton.style.left = '25px';
    zenButton.style.zIndex = '999999999';
    zenButton.style.width = '20px';
    zenButton.style.height = '20px';

    anchorContainer.appendChild(zenButton);
}

// --- НОВЫЙ КОД ДЛЯ РЕШЕНИЯ ПРОБЛЕМЫ ---

// 1. Создаем "наблюдателя", который будет следить за изменениями на странице.
let executionTimeout; // Переменная для хранения таймера

const observer = new MutationObserver(() => {
    // Отменяем предыдущий запланированный вызов, если он есть
    clearTimeout(executionTimeout);

    // Планируем новый вызов через 250 мс
    executionTimeout = setTimeout(() => {
        // Эта функция выполнится только один раз,
        // после того как "шторм" изменений в DOM утихнет.
        console.log('Проверяем наличие кнопки...'); // Для отладки
        createZenModeButton();
    }, 200); // Задержка в миллисекундах
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Вызываем функцию сразу после определения
createZenModeButton();
createOurCustomButton();

function createOurCustomButton() {
    // 1. Находим целевую кнопку (Текстомузыка)
    const lyricsButton = document.querySelector('[data-test-id="PLAYERBAR_DESKTOP_SYNC_LYRICS_BUTTON"]');

    if (!lyricsButton) {
        // Если кнопка не найдена, выходим. Наблюдатель попробует снова.
        return;
    }

    if (document.getElementById('ourCustomButton')) {
        // Если наша кнопка уже существует, выходим.
        return;
    }

    // 2. Создаем div-обертку
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-flex'; // Позволяет обертке вести себя как элемент в строке
    wrapper.style.alignItems = 'center';
    wrapper.style.justifyContent = 'center';

    // 3. Заменяем оригинальную кнопку на нашу обертку, перемещая кнопку внутрь
    lyricsButton.parentNode.insertBefore(wrapper, lyricsButton);
    wrapper.appendChild(lyricsButton);

    // 4. Создаем нашу кастомную кнопку
    const customButton = document.createElement('button');
    customButton.id = 'ourCustomButton';
    customButton.className = 'our-custom-button';
    customButton.innerHTML = '💬︎';
    customButton.setAttribute('data-tooltip', 'Комментарии');
    customButton.onclick = (e) => {
        e.stopPropagation(); // Предотвращаем клик по родительской кнопке
        showUltimateModal();
    };

    // 5. Позиционируем кнопку как бейдж в правом верхнем углу
    customButton.style.position = 'absolute';
    customButton.style.top = '2px';
    customButton.style.right = '40px';
    customButton.style.zIndex = '10';
    customButton.style.width = '28px';
    customButton.style.height = '28px';
    customButton.style.fontSize = '16px';

    wrapper.appendChild(customButton);
}


/**
 * =========================================================================
 *                          БЛОК ULTIMATE УВЕДОМЛЕНИЯ
 * =========================================================================
 */

/**
 * Инициализирует и создает модальное окно (один раз).
 */
function initUltimateModal() {
    if (document.getElementById('ultimate-modal-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ultimate-modal-panel';

    panel.innerHTML = `
        <div class="ultimate-modal-header">
            ⭐ Эксклюзив ChromaSync Ultimate
        </div>
        <div class="ultimate-modal-content">
            <p>Обсуждение треков, аудио-реактивная пульсация и другие уникальные возможности доступны только в <b>Ultimate-версии</b>!</p>
            <p>Пожалуйста, поддержите проект и получите благодарность от меня</p>
            <a href="https://t.me/ChromaSyncBOT" target="_blank" class="ultimate-modal-button">Поддержать в @ChromaSyncBOT</a>
        </div>
        <button class="ultimate-modal-close-btn">&times;</button>
    `;

    document.body.appendChild(panel);

    // Закрытие по клику на кнопку
    panel.querySelector('.ultimate-modal-close-btn').addEventListener('click', hideUltimateModal);

    // Закрытие по клику вне окна (на оверлей)
    panel.addEventListener('click', (e) => {
        if (e.target === panel) {
            hideUltimateModal();
        }
    });
}

/**
 * Показывает модальное окно.
 */
function showUltimateModal() {
    const panel = document.getElementById('ultimate-modal-panel');
    if (!panel) return;
    panel.classList.add('visible');
}

/**
 * Скрывает модальное окно.
 */
function hideUltimateModal() {
    const panel = document.getElementById('ultimate-modal-panel');
    if (!panel) return;
    panel.classList.remove('visible');
}

// =========================================================================

/**
 * Инициализирует два слоя для фона, если они еще не созданы.
 * Настраивает эффект параллакса.
 */
const initializeBackgroundLayers = () => {
    if (bgLayer1) return
    bgLayer1 = createLayer('-2')
    bgLayer2 = createLayer('-3')
    // Экспортируем слои во внешний мир для beat-pulse.js
    window.bgLayer1 = bgLayer1
    window.bgLayer2 = bgLayer2
    activeLayer = bgLayer1
    inactiveLayer = bgLayer2
    window.addEventListener('mousemove', throttle(handleParallax, 33))
    loadVibrantScript()
    console.log('[ChromaSync] Двухслойная система фона с параллаксом инициализирована.')
}

/**
 * Обновляет фоновое изображение с плавной сменой.
 * Использует систему из двух слоев для кроссфейда.
 * @param {string} imgBackground - URL нового фонового изображения.
 * @param {number} callId - Уникальный ID вызова, чтобы предотвратить "состояние гонки".
 */
const updateBackgroundImage = (imgBackground, callId) => {
    if (!activeLayer || activeLayer.style.backgroundImage.includes(imgBackground)) {
        return
    }

    const img = new Image()
    img.crossOrigin = 'Anonymous' // Необходимо для анализа картинки с другого домена.
    img.src = imgBackground

    img.onload = () => {
        // Проверка на актуальность: если ID вызова устарел, игнорируем его.
        if (callId !== lastCoverChangeId) {
            console.log(`[ChromaSync] Игнорирую устаревшую обложку (ID вызова: ${callId}, текущий ID: ${lastCoverChangeId})`)
            return
        }
        inactiveLayer.style.backgroundImage = `url(${imgBackground})`
        requestAnimationFrame(() => {
            inactiveLayer.style.opacity = '1'
        })
        setTimeout(() => {
            // Дополнительная проверка на случай смены трека во время анимации.
            if (callId !== lastCoverChangeId) {
                console.log(`[ChromaSync] Отменяю устаревшую анимацию (ID вызова: ${callId}, текущий ID: ${lastCoverChangeId})`)
                return
            }
            activeLayer.style.opacity = '0'
            const temp = activeLayer
            activeLayer = inactiveLayer
            inactiveLayer = temp
        }, 500)
    }
    img.onerror = () => {
        console.error('[ChromaSync] Не удалось загрузить изображение для фона:', imgBackground)
    }
}

/* --- Блок 4: Логика смены обложки и главный наблюдатель --- */

let currentImgBackground = '' // URL текущей обложки.
let lastCoverChangeId = 0 // Уникальный ID для каждого запроса на смену обложки.
const debouncedColorUpdate = debounce(updateChameleonColors, 400) // Debounced-версия для анализа цвета.

/**
 * Надежно ищет URL текущей обложки на странице в нескольких местах.
 * @returns {string|null} URL обложки или null, если не найдена.
 */
const coverURL = () => {
    // Внутренняя функция для проверки, является ли URL заглушкой.
    const isPlaceholder = src => {
        if (!src) return true
        const lowerSrc = src.toLowerCase()
        return (
            lowerSrc.includes('default') ||
            lowerSrc.includes('placeholder') ||
            lowerSrc.includes('images/default/') ||
            lowerSrc.includes('logo') ||
            (!lowerSrc.includes('/100x100') && !lowerSrc.includes('/1000x1000'))
        )
    }

    // Порядок поиска: мини-плеер, фуллскрин-плеер, запасной вариант.
    const imgMini = document.querySelector('div[data-test-id="PLAYERBAR_DESKTOP_COVER_CONTAINER"] img')
    if (imgMini?.src && !isPlaceholder(imgMini.src)) return imgMini.src
    const imgFull = document.querySelector('[data-test-id="FULLSCREEN_PLAYER_MODAL"] img[data-test-id="ENTITY_COVER_IMAGE"]')
    if (imgFull?.src && !isPlaceholder(imgFull.src)) return imgFull.src
    const any = document.querySelector('img[data-test-id="ENTITY_COVER_IMAGE"]')
    if (any?.src && !isPlaceholder(any.src)) return any.src

    console.log('[ChromaSync] Обложка не найдена или это плейсхолдер.')
    return null
}

/**
 * Главный обработчик, который запускается при потенциальной смене обложки.
 */
const handleCoverChange = () => {
    const newSrc = coverURL()
    if (!newSrc) return

    // Преобразуем URL в версию высокого разрешения.
    const newImgBackground = newSrc.includes('/100x100') ? newSrc.replace('/100x100', '/1000x1000') : newSrc

    if (newImgBackground !== currentImgBackground) {
        currentImgBackground = newImgBackground
        lastCoverChangeId++ // Увеличиваем ID, чтобы отменить предыдущие операции.
        const currentCallId = lastCoverChangeId

        initializeBackgroundLayers()
        updateBackgroundImage(newImgBackground, currentCallId) // Немедленное обновление фона.
        debouncedColorUpdate(newImgBackground) // Отложенное обновление цвета.

        console.log(`[ChromaSync] Обложка изменилась (ID ${currentCallId}). Фон обновляется, цвет запланирован.`)
    }
}

/**
 * Наблюдатель за изменениями в DOM.
 * Оптимизирован для срабатывания только при изменениях, связанных с <img>.
 * @type {MutationObserver}
 */
const mainObserver = new MutationObserver(mutationsList => {
    // Проверяем, есть ли в мутациях то, что нас интересует.
    const isRelevant = mutationsList.some(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'src' && mutation.target.tagName === 'IMG') {
            return true // Изменился src у картинки.
        }
        if (mutation.type === 'childList') {
            const checkNodes = nodeList => {
                // Добавлена или удалена картинка.
                for (const node of nodeList) {
                    if (node.nodeType !== 1) continue
                    if (node.tagName === 'IMG' || node.querySelector('img')) return true
                }
                return false
            }
            if (checkNodes(mutation.addedNodes) || checkNodes(mutation.removedNodes)) {
                return true
            }
        }
        return false
    })

    if (isRelevant) {
        handleCoverChange()
    }
})

// Запускаем наблюдатель.
mainObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'], // Следим только за атрибутом 'src'.
})

/* --- Блок 5: Исправления багов интерфейса Яндекс.Музыки --- */

/**
 * Блокирует стандартное поведение двойного клика на плеере,
 * которое открывает полноэкранный режим.
 * @param {HTMLElement} element - Элемент, на который вешается блокировщик.
 */
const attachDoubleClickBlocker = element => {
    element.addEventListener(
        'dblclick',
        event => {
            event.preventDefault()
            event.stopPropagation()
        },
        {
            capture: true,
            once: true,
        },
    )
    console.log('[ChromaSync] Блокировщик двойного клика установлен на PlayerBar.')
}

// Наблюдатель для поиска плеера и установки блокировщика.
const dblClickObserver = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
        if (mutation.addedNodes) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    const playerBar = node.matches('.PlayerBar_root__cXUnU') ? node : node.querySelector('.PlayerBar_root__cXUnU')
                    if (playerBar) {
                        attachDoubleClickBlocker(playerBar)
                        observer.disconnect() // Нашли, обработали, отключились.
                    }
                }
            })
        }
    }
})

// Сначала ищем элемент сразу, если не находим - запускаем наблюдатель.
const initialPlayerBar = document.querySelector('.PlayerBar_root__cXUnU')
if (initialPlayerBar) {
    attachDoubleClickBlocker(initialPlayerBar)
} else {
    dblClickObserver.observe(document.body, {
        childList: true,
        subtree: true,
    })
}

/**
 * Принудительно устанавливает темную тему оформления.
 * Это нужно, чтобы стили темы всегда работали корректно.
 */
const forceDarkTheme = () => {
    const body = document.body
    if (body.classList.contains('ym-light-theme')) {
        body.classList.replace('ym-light-theme', 'ym-dark-theme')
    } else if (!body.classList.contains('ym-dark-theme')) {
        body.classList.add('ym-dark-theme')
    }
}

// Наблюдатель, который следит, чтобы тема не переключалась обратно на светлую.
const themeObserver = new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            forceDarkTheme()
        }
    }
})
themeObserver.observe(document.body, {
    attributes: true,
})
forceDarkTheme() // Устанавливаем тему сразу при запуске.

/**
 * Этот блок кода создает CSS-правила, чтобы фон некоторых модальных окон
 * наследовал цвет от специальной CSS-переменной, вместо стандартного белого/серого.
 */
const css = `
:root { --background-color: #000; }
.TrackLyricsModal_root__KsVRf,
.QualitySettingsModal_root__f3gE2,
.QualitySettingsContextMenu_root_withEqualizer__GPjIg,
.TrailerModal_modalContent__ZSNFe,
.TrackAboutModalDesktop_root_withWindows__jIOiB {
    background-color: var(--background-color);
}
`
const style = document.createElement('style')
style.appendChild(document.createTextNode(css))
document.head.appendChild(style)

/**
 * Обновляет CSS-переменную --background-color на основе цвета плеера.
 * @param {HTMLElement} playerBar - Элемент плеера.
 */
const updateRootBackgroundColor = playerBar => {
    const newColor = getComputedStyle(playerBar).getPropertyValue('--player-average-color-background').trim()
    if (newColor) {
        document.documentElement.style.setProperty('--background-color', newColor)
    }
}

// Наблюдатель, который ждет появления плеера, чтобы начать отслеживать его цвет.
const playerBarObserver = new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && node.matches('section.PlayerBar_root__cXUnU')) {
                updateRootBackgroundColor(node)
                const styleObserver = new MutationObserver(() => updateRootBackgroundColor(node))
                styleObserver.observe(node, {
                    attributes: true,
                    attributeFilter: ['style'],
                })
                observer.disconnect()
                return
            }
        }
    }
})

// Сначала ищем плеер сразу, если не находим - запускаем наблюдатель.
const initialPlayerBarElement = document.querySelector('section.PlayerBar_root__cXUnU')
if (initialPlayerBarElement) {
    updateRootBackgroundColor(initialPlayerBarElement)
    const styleObserver = new MutationObserver(() => updateRootBackgroundColor(initialPlayerBarElement))
    styleObserver.observe(initialPlayerBarElement, {
        attributes: true,
        attributeFilter: ['style'],
    })
} else {
    playerBarObserver.observe(document.body, {
        childList: true,
        subtree: true,
    })
}

/* --- Блок 6: Управление настройками из PulseSync (handleEvents.json) --- */

let settings = {} // Глобальный объект с текущими настройками.
let lastAppliedSettings = {} // Объект для хранения последнего примененного состояния.

/**
 * Универсальная функция для применения CSS-стилей в ответ на изменение настроек.
 * @param {string|string[]} settingKeys - Ключ или массив ключей настроек для отслеживания.
 * @param {string} styleId - ID для элемента <style>, который будет создан или обновлен.
 * @param {Function} cssGenerator - Функция, которая принимает значение настройки и возвращает CSS-строку.
 */
const updateStyleOnSettingChange = (settingKeys, styleId, cssGenerator) => {
    const keys = Array.isArray(settingKeys) ? settingKeys : [settingKeys]
    // Проверяем, изменилась ли хотя бы одна из отслеживаемых настроек.
    const hasChanged = keys.some(key => {
        const current = settings[key]
        const last = lastAppliedSettings[key]
        return current && (!last || current.value !== last.value)
    })

    if (hasChanged) {
        let styleElement = document.getElementById(styleId)
        if (!styleElement) {
            styleElement = document.createElement('style')
            styleElement.id = styleId
            document.head.appendChild(styleElement)
        }
        styleElement.textContent = cssGenerator(settings) // Генерируем и применяем CSS.
        // Обновляем последние примененные настройки.
        keys.forEach(key => {
            if (settings[key]) {
                lastAppliedSettings[key] = { ...settings[key] }
            }
        })
        console.log(`[ChromaSync] Обновлен динамический стиль: ${styleId}`)
    }
}

let SETTINGS_API = null;
let _setSettingsQueuePromise = Promise.resolve();

const SELECTOR_MAPPINGS = {
    "accentColorSource": [
        "Vibrant",
        "LightVibrant",
        "DarkVibrant",
        "Muted",
        "LightMuted",
        "DarkMuted"
    ]
};

function resolveSelectorValues(s) {
    if (!s) return s;
    const mapped = {};
    for (const key in s) {
        const cleanKey = key.replace(/_\d+$/, '');

        if (mapped[cleanKey] && key !== cleanKey) {
            mapped[cleanKey] = { ...s[key] };
        } else {
            mapped[cleanKey] = { ...s[key] };
        }

        mapped[key] = { ...s[key] };

        if (SELECTOR_MAPPINGS[cleanKey] && mapped[cleanKey].value !== undefined && mapped[cleanKey].value !== null) {
            const val = mapped[cleanKey].value.toString();
            if (/^\d+$/.test(val)) {
                const index = parseInt(val, 10);
                if (SELECTOR_MAPPINGS[cleanKey][index] !== undefined) {
                    mapped[cleanKey].value = SELECTOR_MAPPINGS[cleanKey][index];
                    mapped[key].value = mapped[cleanKey].value;
                }
            }
        }
    }
    return mapped;
}

function setSettings(newSettings) {
    _setSettingsQueuePromise = _setSettingsQueuePromise
        .then(() => _setSettingsCore(newSettings))
        .catch(e => console.error('[ChromaSync] Error in settings queue:', e));
    return _setSettingsQueuePromise;
}

/**
 * Главная функция, которая применяет все настройки к элементам страницы.
 * @param {object} newSettings - Объект с новыми настройками.
 */
async function _setSettingsCore(newSettings) {
    if (!newSettings) {
        console.warn('[ChromaSync] Попытка применить пустые настройки. Операция отменена.')
        return
    }
    
    // Синхронизируем глобальное состояние прямо перед выполнением кадра из очереди,
    // чтобы функции вроде updateStyleOnSettingChange видели правильный стейт, исключая гонку.
    settings = newSettings;
    // Обновление заголовка темы
    const titleGroup = newSettings.themeTitleText || newSettings.themeTitle || newSettings.themeTitleText_1
    const titleValue = newSettings.themeTitleText_1?.value ||
        (titleGroup && (titleGroup.text?.value ?? titleGroup.text ?? titleGroup.value)) ||
        'ChromaSync Lite'

    syncHeaderOverlayText(titleValue)

    // Управляем видимостью кнопки Zen Mode
    const zenButton = document.getElementById('zenModeButton');
    if (zenButton) {
        zenButton.style.display = newSettings.showZenModeButton?.value ? 'block' : 'none';
    }

    // Получение цвета плеера для других элементов (например, логотипа).
    const playerBarElement = document.querySelector('section.PlayerBar_root__cXUnU')
    let globalPlayerColor = ''
    if (playerBarElement) {
        globalPlayerColor = playerBarElement.style.getPropertyValue('--player-average-color-background').trim()
    }

    /* lite: no proDevOverride */

    /* lite: no license buttons or auto-login */

    // Комбинированный стиль для блоков, зависящих от нескольких настроек.
    const isFirstRun = !lastAppliedSettings.hasOwnProperty('toggleFullscreenVibeBlock')
    const vibeBlockChanged = !isFirstRun && lastAppliedSettings.toggleFullscreenVibeBlock.value !== newSettings.toggleFullscreenVibeBlock.value
    const logoColorSettingChanged =
        !isFirstRun && lastAppliedSettings.toggleVariableNextLogoColor.value !== newSettings.toggleVariableNextLogoColor.value
    const playerColorChanged = lastAppliedSettings.globalPlayerColor !== globalPlayerColor
    if (isFirstRun || vibeBlockChanged || logoColorSettingChanged || playerColorChanged) {
        let combinedStyle = document.getElementById('combined-style')
        if (!combinedStyle) {
            combinedStyle = document.createElement('style')
            combinedStyle.id = 'combined-style'
            document.head.appendChild(combinedStyle)
        }
        combinedStyle.textContent = `
            /* Размер блока "Моя волна" */
            .VibeBlock_root__z7LtR {
                min-height: ${newSettings.toggleFullscreenVibeBlock.value ? '79.8vh' : '400px'} !important;
                max-height: ${newSettings.toggleFullscreenVibeBlock.value ? '79.8vh' : '400px'} !important;
            }
            @media (min-width: 1079px) {
                .VibeBlock_root__z7LtR {
                    min-height: ${newSettings.toggleFullscreenVibeBlock.value ? '84.2vh' : '400px'} !important;
                    max-height: ${newSettings.toggleFullscreenVibeBlock.value ? '84.2vh' : '400px'} !important;
                }
            }
            /* Цвет логотипа */
            .NavbarDesktop_logo__Z4jGx * {
                color: ${newSettings.toggleVariableNextLogoColor.value ? globalPlayerColor : ''} !important;
                filter: brightness(${newSettings.toggleVariableNextLogoColor.value ? '1.4' : '1.0'}) !important;
            }
        `
        lastAppliedSettings.toggleFullscreenVibeBlock = { ...newSettings.toggleFullscreenVibeBlock }
        lastAppliedSettings.toggleVariableNextLogoColor = { ...newSettings.toggleVariableNextLogoColor }
        lastAppliedSettings.globalPlayerColor = globalPlayerColor
    }

    // Мгновенное применение настроек акцентного цвета.
    const accentSourceSetting = newSettings.accentColorSource
    const useCustomColorSetting = newSettings.useCustomAccentColor
    const customColorSetting = newSettings.customAccentColor
    const accentSourceChanged =
        accentSourceSetting && (!lastAppliedSettings.accentColorSource || lastAppliedSettings.accentColorSource.value !== accentSourceSetting.value)
    const useCustomColorChanged =
        useCustomColorSetting &&
        (!lastAppliedSettings.useCustomAccentColor || lastAppliedSettings.useCustomAccentColor.value !== useCustomColorSetting.value)
    const customColorChanged =
        customColorSetting && (!lastAppliedSettings.customAccentColor || lastAppliedSettings.customAccentColor.value !== customColorSetting.value)
    if (accentSourceChanged || useCustomColorChanged || customColorChanged) {
        console.log('[ChromaSync] Настройки цвета изменены. Применяю немедленно.')
        applyChameleonStyles(lastPalette, accentSourceSetting?.value)
        if (accentSourceSetting) lastAppliedSettings.accentColorSource = { ...accentSourceSetting }
        if (useCustomColorSetting) lastAppliedSettings.useCustomAccentColor = { ...useCustomColorSetting }
        if (customColorSetting) lastAppliedSettings.customAccentColor = { ...customColorSetting }
    }

    // Применение динамических стилей через универсальную функцию.
    updateStyleOnSettingChange(['trackModalOpacity', 'globalSaturate', 'globalBlur', 'globalBrightness'], 'transparency-and-blur-style', s => {
        const opacity = s.trackModalOpacity?.value / 100 ?? 0.65
        const saturate = s.globalSaturate?.value ?? 200
        const blur = s.globalBlur?.value ?? 0.9375
        const brightness = s.globalBrightness?.value ?? 1
        const fullFilter = `saturate(${saturate}%) blur(${blur}rem) brightness(${brightness})`.trim()
        return `
                .TrackModal_root__QrFg6.ifxS_8bgSnwBoCsyow0E::before {
                    background-color: rgba(25, 25, 25, ${opacity}) !important;
                }
                .ifxS_8bgSnwBoCsyow0E {
                    backdrop-filter: ${fullFilter} !important;
                }
            `
    })

    updateStyleOnSettingChange(['mainElementsBlur', 'mainElementsBrightness'], 'main-elements-style', s => {
        const blur = s.mainElementsBlur?.value ?? 70
        const brightness = s.mainElementsBrightness?.value ?? 1.5
        return `
                .Content_main__8_wIa,
                .PlayerBarDesktopWithBackgroundProgressBar_playerBar__mp0p9,
                .ReleaseNotesModal_root__RSw1p,
                .Donation_root__nwHCN {
                    backdrop-filter: blur(${blur}px) brightness(${brightness}) !important;
                }
            `
    })

    updateStyleOnSettingChange(['navbarBlur', 'navbarBrightness'], 'navbar-style', s => {
        const blur = s.navbarBlur?.value ?? 70
        const brightness = s.navbarBrightness?.value ?? 1.5
        return `
                .NavbarDesktop_root__scYzp {
                    backdrop-filter: blur(${blur}px) brightness(${brightness}) !important;
                }
            `
    })

    // Яркость фона (прямое изменение стиля элемента, без генерации <style>).
    const bgBrightnessSetting = newSettings.backgroundBrightness
    const bgBrightnessChanged =
        bgBrightnessSetting &&
        (!lastAppliedSettings.backgroundBrightness || lastAppliedSettings.backgroundBrightness.value !== bgBrightnessSetting.value)
    if (bgBrightnessChanged) {
        const brightnessValue = bgBrightnessSetting.value
        if (bgLayer1) bgLayer1.style.filter = `blur(3px) brightness(${brightnessValue})`
        if (bgLayer2) bgLayer2.style.filter = `blur(3px) brightness(${brightnessValue})`
        console.log(`[ChromaSync] Яркость фона обновлена: ${brightnessValue}`)
        lastAppliedSettings.backgroundBrightness = { ...bgBrightnessSetting }
    }

    updateStyleOnSettingChange('togglePlayerBorder', 'player-border-style', s =>
        s.togglePlayerBorder?.value
            ? `
                .PlayerBarDesktopWithBackgroundProgressBar_player__ASKKs {
                    box-shadow: 0 0 20px -3px var(--accent-color, #0000);
                    border-color: var(--accent-color, #fff1);
                    transition: border-color 0.7s ease, box-shadow 0.7s ease;
                }
            `
            : `
                .PlayerBarDesktopWithBackgroundProgressBar_player__ASKKs {
                    box-shadow: none;
                    border-color: transparent;
                }
            `,
    )

    updateStyleOnSettingChange('toggleMainBorders', 'main-borders-style', s => {
        if (s.toggleMainBorders?.value === false) {
            return `
                .NavbarDesktop_root__scYzp,
                .PlayerBar_root__cXUnU,
                .Content_main__8_wIa {
                    border-color: transparent !important;
                    box-shadow: none !important;
                }
            `
        }
        return ''
    })

    updateStyleOnSettingChange('hideVibeAnimation', 'vibe-animation-style', s => {
        return s.hideVibeAnimation && s.hideVibeAnimation.value
            ? `.VibeAnimation_enter_active__j0jOl,
           .VibeAnimation_enter_done__Oi2Kz,
           .VibeAnimation_exit__ioGXk { opacity: 0 !important; }`
            : ``
    })

    // Акцент на кнопке Play
    updateStyleOnSettingChange(['togglePlayButtonAccentColor'], 'play-button-icon-accent-style', s => {
        const isEnabled = s.togglePlayButtonAccentColor?.value ?? false
        const color = isEnabled ? 'var(--accent-color)' : 'var(--ym-controls-color-default-enabled)'
        return `.PlayButton_icon__t_THQ { color: ${color} !important; }`
    })

    // Lite: пульсация отключена

    // Блокировщик рекламы и лишних модулей
    const modulesToBlock = ['betabutton', 'donations', 'artistrecommends', 'concerts']
    modulesToBlock.forEach(moduleKey => {
        if (settings[moduleKey]?.value && !lastAppliedSettings[moduleKey]) {
            console.log(`[OpenBlocker] Скрываю модуль: ${moduleKey}`)
            let styleElement = document.getElementById(`block-${moduleKey}-style`)
            if (!styleElement) {
                styleElement = document.createElement('style')
                styleElement.id = `block-${moduleKey}-style`
                document.head.appendChild(styleElement)
                styleElement.textContent = `.promo-popup-${moduleKey}, .${moduleKey} { display: none !important; }`
            }
        } else if (!settings[moduleKey]?.value && lastAppliedSettings[moduleKey]) {
            const styleElement = document.getElementById(`block-${moduleKey}-style`)
            if (styleElement) styleElement.remove()
        }
    })

    // Автовоспроизведение при запуске.
    const autoPlaySetting = newSettings.devAutoPlayOnStart
    if (autoPlaySetting?.value && !window.hasRun) {
        document.querySelector(`section.PlayerBar_root__cXUnU * [data-test-id="PLAY_BUTTON"]`)?.click()
        window.hasRun = true
    }

    // Lite: настройки BeatPulse отсутствуют

    // Hide Beta button
    const betaToggle = newSettings.hideBetaButton
    const betaStyleId = 'beta-hide-style'
    const betaCss = `.MainPage_beta_withReleaseNotes__WOjUk, .MainPage_beta__y32vb { opacity: 0 !important; pointer-events: none !important; }`
    let betaStyle = document.getElementById(betaStyleId)
    if (betaToggle && betaToggle.value) {
        if (!betaStyle) {
            betaStyle = document.createElement('style')
            betaStyle.id = betaStyleId
            betaStyle.textContent = betaCss
            document.head.appendChild(betaStyle)
        }
    } else {
        if (betaStyle) betaStyle.remove()
    }
}

function initSettings() {
    if (SETTINGS_API || !window.pulsesyncApi) return;

    const base = String(window.__chromasyncMetaName || 'ChromaSync').trim();
    const candidateNames = [];
    const lower = base.toLowerCase();
    if (/ultimate|lite/.test(lower)) {
        candidateNames.push(base);
    } else {
        candidateNames.push(base + ' Lite', base, base + ' Ultimate');
    }

    for (const name of candidateNames) {
        try {
            const api = window.pulsesyncApi?.getSettings?.(name);
            if (api && api.onChange) {
                SETTINGS_API = api;
                window.__chromasyncMetaNameFound = name;
                console.debug(`[ChromaSync] WebSocket API успешно подключен к '${name}'`);
                break;
            }
        } catch (e) { }
    }

    if (SETTINGS_API) {
        const attemptHydration = () => {
            const s = SETTINGS_API.getCurrent() || {};
            if (Object.keys(s).length === 0) {
                setTimeout(attemptHydration, 200);
                return;
            }
            const remapped = resolveSelectorValues(s);
            setSettings(remapped).catch(e => console.error(e));
            console.debug('[ChromaSync] Начальные настройки успешно гидратированы.');
        };
        attemptHydration();

        SETTINGS_API.onChange(s => {
            const remapped = resolveSelectorValues(s || {});
            setSettings(remapped);
            console.debug('[ChromaSync] Применены обновленные настройки (WebSocket).');
        });
    } else {
        console.warn('[ChromaSync] API не найдено. Ожидание генерации...');
        setTimeout(initSettings, 500);
    }
}

function update() {
    if (document.hidden || window.__csSettingsPollingPaused === true) return;
    if (SETTINGS_API) {
        const s = SETTINGS_API.getCurrent() || {};
        if (Object.keys(s).length > 0) {
            const remapped = resolveSelectorValues(s);
            setSettings(remapped);
        }
    }
}

function init() {
    initSettings()
}

/**
 * Обработчик события, когда страница становится видимой.
 */
const forceSyncOnVisibility = () => {
    setTimeout(() => {
        console.log('[ChromaSync] Окно стало видимым. Запускаю принудительную синхронизацию...')
        handleCoverChange()
        if (mainObserver) {
            mainObserver.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src'],
            })
            console.log('[ChromaSync] Наблюдатель DOM снова подключен.')
        }
    }, 400)
}

// Слушатель события 'visibilitychange' для оптимизации.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Отключаем наблюдатель, когда вкладка неактивна, чтобы экономить ресурсы.
        if (mainObserver) {
            mainObserver.disconnect()
            console.log('[ChromaSync] Наблюдатель DOM отключен из-за неактивности вкладки.')
        }
    } else {
        forceSyncOnVisibility()
    }
})

window.addEventListener('focus', () => { })

// Lite version: no PRO bundle loader
function loadBeatPulseIfNeeded() {
    /* noop in Lite */
}

// call loader on settings change and on visibility/focus
document.addEventListener('visibilitychange', () => {
    /* lite: no pro loader */
})
window.addEventListener('focus', () => {
    /* lite: no pro loader */
})
// Ensure we do not keep PRO active without license (still relevant to clear orphan state)
setTimeout(() => {
    try {
        cleanupUnauthorizedPro()
    } catch { }
}, 0)

// Запускаем всю логику.
init()

    // Disable Yandex.Metrika script and guard against re-adding

    // Close SOUND_QUALITY menu on second click (toggle behavior)
    ; (function fixSoundQualityToggle() {
        const isMenuOpen = () => !!document.querySelector('[data-test-id="QUALITY_SETTINGS_CONTEXT_MENU"]')
        document.addEventListener(
            'click',
            ev => {
                const btn = ev.target && ev.target.closest('button[data-test-id="SOUND_QUALITY_BUTTON"]')
                if (!btn) return
                if (isMenuOpen()) {
                    // Already open: intercept and close via Escape
                    ev.preventDefault()
                    ev.stopImmediatePropagation()
                    const esc = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true })
                    document.dispatchEvent(esc)
                    setTimeout(() => {
                        const menu = document.querySelector('[data-test-id="QUALITY_SETTINGS_CONTEXT_MENU"]')
                        if (menu) menu.remove()
                    }, 50)
                }
            },
            true,
        )
    })()

// Lite version: no BeatPulse startup hooks

function ensurePSBPanel() {
    let panel = document.querySelector('div.PSBpanel')
    if (!panel) {
        panel = document.createElement('div')
        panel.className = 'PSBpanel'
        const p = document.createElement('p')
        p.className = 'PSB-text'
        panel.appendChild(p)
        document.body.appendChild(panel)
    } else {
        let p = panel.querySelector('.PSB-text') || panel.querySelector('p')
        if (p && !p.classList.contains('PSB-text')) p.classList.add('PSB-text')
        if (!p) {
            p = document.createElement('p')
            p.className = 'PSB-text'
            panel.appendChild(p)
        }
    }
    // Убираем вызов отсюда
    return panel
}

function getTitlebarSelector() {
    try {
        const arr = typeof window.findCssRuleByPartialName === 'function' ? window.findCssRuleByPartialName('TitleBar_pulseText') : null
        if (Array.isArray(arr) && arr.length && typeof arr[0] === 'string') return arr[0]
    } catch { }
    return null
}

function applyTitlebarCss(selector) {
    if (!selector) return
    let styleEl = document.getElementById('cs-titlebar-style')
    if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = 'cs-titlebar-style'
        document.head.appendChild(styleEl)
    }
    styleEl.textContent = `${selector} { position: fixed; color: #fff; left: 50%; transform: translate(-50%, -2px); z-index: 9999; font-weight: 500; padding: 3px; border-radius: 5px; visibility: visible; }`
}

function syncHeaderOverlayText(text) {
    const desired = String(text ?? '').trim() || 'ChromaSync'
    let panel = document.querySelector('div.PSBpanel')

    // если есть нативный PulseSync title, отключаем кастомизацию надписи
    // if (document.querySelector('span[class*="TitleBar_pulseText"]')) {
    //     if (panel) panel.style.display = 'none'
    //     const hideStyle = document.getElementById('psb-hide-origin')
    //     if (hideStyle) hideStyle.remove()
    //     return
    // }

    panel = panel || ensurePSBPanel()
    if (!panel) return

    panel.style.display = ''
    panel.style.pointerEvents = 'none'

    let p = panel.querySelector('.PSB-text') || panel.querySelector('p')
    if (!p) {
        p = document.createElement('p')
        p.className = 'PSB-text'
        panel.appendChild(p)
    }

    p.style.top = '4px'
    p.style.margin = '0'
    if (p.textContent !== desired) p.textContent = desired

    const selector = getTitlebarSelector()
    let hideStyle = document.getElementById('psb-hide-origin')

    if (!selector) {
        if (hideStyle) hideStyle.remove()
        return
    }

    if (!hideStyle) {
        hideStyle = document.createElement('style')
        hideStyle.id = 'psb-hide-origin'
        document.head.appendChild(hideStyle)
    }
    hideStyle.textContent = `${selector} { visibility: hidden !important; }`
}

// Prewarm Vibrant as early as possible
loadVibrantScript().catch(() => { })
