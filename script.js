// ملف الكود الرئيسي (JavaScript) — يُحمَّل بعد data.js
    // البيانات (kmlBase64) تُحمَّل من الملف الخارجي data.js


    // تفعيل وظيفة زر تسجيل الدخول والتحقق من البيانات (يدعم المستخدمين: 0/0 و ali/123) مع ترك الحقول فارغة عند الفتح
    document.getElementById('loginSubmitBtn').addEventListener('click', function() {
        const u = document.getElementById('loginUser').value.trim();
        const p = document.getElementById('loginPass').value.trim();
        const err = document.getElementById('loginError');

        if ((u === '0' && p === '0') || (u === 'ali' && p === '123')) {
            document.getElementById('loginOverlay').style.display = 'none';
            setTimeout(() => { map.invalidateSize(); }, 200);
        } else {
            err.style.display = 'block';
        }
    });

    const canvasRenderer = L.canvas({ padding: 0.5 });

    const googleMapLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps'
    });
    const satLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Earth'
    });
    const esriLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '© Esri'
    });
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });

    const baseLayers = {
        "<span style='color: #023059; font-weight: bold;'>Google Map</span>": googleMapLayer,
        "<span style='color: #023059; font-weight: bold;'>Google Earth</span>": satLayer,
        "<span style='color: #023059; font-weight: bold;'>Esri World Street Map</span>": esriLayer,
    };

    const map = L.map('map', { 
        center: [24.7136, 46.6753], 
        zoom: 6, 
        layers: [googleMapLayer],
        renderer: canvasRenderer
    });
    
    const layerControl = L.control.layers(baseLayers).addTo(map);

    setTimeout(() => { map.invalidateSize(); }, 200);

    let allItems = [];
    let currentFilteredItems = [];
    let selectedItemForDetails = null;
    let markersLayer = L.layerGroup().addTo(map);
    let currentActiveTab = 'tabPoints'; 
    let currentChartType = 'points';
    let currentPointsSubField = 'نوع العقد';
    let myChart = null;

    let activeFilters = {
        status: 'all',          
        landStatus: 'all',      
        municipality: 'all',
        contractType: 'all',
        expiryFilter: 'all',
        forasStatus: 'all',
        forasActivity: 'all',
        forasSubActivity: 'all',
        zwaedStatus: 'all',
        zwaedMunicipality: 'all'
    };

    const pointFields = [
        "رقم العقد", "وصف الفرصة", "نوع العقد", "مصدر العقد", "مدة العقد",
        "حالة سريان العقد", "القيمة السنوية للعقد", "القيمة السنوية للعقد شاملة ضريبة القيمة المضافة",
        "تاريخ بداية العقد", "تاريخ نهاية العقد", "اسم المستثمر"
    ];

    let polygonFields = [
        "رقم قطعة الأرض من المخطط", 
        "رقم المخطط", 
        "حالة الاستثمار", 
        "البلدية", 
        "SHAPE_Area"
    ];

    const forasFields = [
        "رقم الفرصة", "وصف الفرصة", "حالة الفرصة", "سبب الإلغاء", 
        "قيمة كراسة الشروط والمواصفات", "موعد اعلان الفرصة الاستثمارية", 
        "تاريخ فتح المظاريف", "النشاط الرئيسي", "النشاط الفرعي", 
        "إجمالي عدد المستثمرين الذين اشتروا الكراسة", 
        "إجمالي عدد المستثمرين المتقدمين بالعطاءات", 
        "مدة العقد", "المساحة", "رقم العقد"
    ];

    const zwaedFields = [
        "رقم قطعة الأرض من المخطط",
        "رقم المخطط",
        "حالة الاستثمار",
        "البلدية",
        "SHAPE_Area"
    ];

    const DB_NAME = 'InvestmentMapDB';
    const STORE_NAME = 'files';
    const DB_VERSION = 1;

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
        });
    }

    async function saveToIndexedDB(fileName, items) {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put({ fileName, items }, 'savedFile');
            return tx.complete;
        } catch(e) {
            console.error('IndexedDB save error:', e);
        }
    }

    async function loadFromIndexedDB() {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const req = store.get('savedFile');
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch(e) {
            console.error('IndexedDB load error:', e);
            return null;
        }
    }

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        if (currentTheme === 'dark') {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }
    });
    if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    // فك تشفير البيانات المدمجة تلقائياً عند التشغيل
    function loadEmbeddedKmlData() {
        try {
            const binString = atob(kmlBase64);
            const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0));
            const decodedKml = new TextDecoder().decode(bytes);
            parseKML(decodedKml, "البيانات المدمجة المشفرة");
        } catch (e) {
            console.error("خطأ في فك تشفير البيانات المدمجة:", e);
        }
    }

    window.addEventListener('DOMContentLoaded', async () => {
        const params = new URLSearchParams(window.location.search);
        if (params.has('status')) activeFilters.status = params.get('status');
        if (params.has('type')) activeFilters.contractType = params.get('type');
        if (params.has('tab')) {
            currentActiveTab = params.get('tab');
            document.querySelectorAll('.tab-btn').forEach(b => {
                if (b.getAttribute('data-tab') === currentActiveTab) b.click();
            });
        }

        // الاعتماد الأساسي على الكود المشفر المدمج لقراءة البيانات
        if (typeof kmlBase64 !== 'undefined' && kmlBase64) {
            loadEmbeddedKmlData();
        } else {
            const savedData = await loadFromIndexedDB();
            if (savedData && savedData.items && savedData.fileName) {
                allItems = savedData.items;
                buildDynamicPolygonFields();
                buildDynamicChips();
                filterAndRender(true);
            }
        }
        updateMapLegend();
    });

    // تحديث مفتاح الخريطة ديناميكياً حسب نوع التبويب النشط (مع تخصيص ألوان الزوائد)
    function updateMapLegend() {
        const legendContainer = document.getElementById('mapLegendContainer');
        if (!legendContainer) return;

        let html = '';
        if (currentActiveTab === 'tabPoints') {
            html = `
                <div class="legend-title">مفتاح عقود الاستثمار</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #059669;"></div>عقود سارية</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #dc2626;"></div>عقود منتهية</div>
            `;
        } else if (currentActiveTab === 'tabPolygons') {
            html = `
                <div class="legend-title">مفتاح الأصول والأراضي</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #2563eb;"></div>أصل عليه عقد</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #dc2626;"></div>أصل شاغر</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #16a34a;"></div>حديقة استثمارية</div>
            `;
        } else if (currentActiveTab === 'tabForas') {
            html = `
                <div class="legend-title">مفتاح الفرص الاستثمارية</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #059669;"></div>معلنة</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #dc2626;"></div>ملغاة</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #2563eb;"></div>جديد</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #F2B02C;"></div>غير مصنف / أخرى</div>
            `;
        } else if (currentActiveTab === 'tabZwaed') {
            html = `
                <div class="legend-title">مفتاح الزوائد</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #8b5cf6;"></div>زوائد تخطيطية</div>
                <div class="legend-item"><div class="legend-color-box" style="background-color: #F20000;"></div>زوائد نزع</div>
            `;
        }
        legendContainer.innerHTML = html;
    }

    document.getElementById('shareBtn').addEventListener('click', () => {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', currentActiveTab);
        url.searchParams.set('status', activeFilters.status);
        url.searchParams.set('type', activeFilters.contractType);
        navigator.clipboard.writeText(url.toString()).then(() => {
            alert('تم نسخ رابط العرض الحالي بنجاح! يمكنك إرساله لأي شخص.');
        });
    });

    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
        btn.addEventListener('click', function() {
            if(!this.getAttribute('data-tab')) return;
            document.querySelectorAll('.tabs-header .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            this.classList.add('active');
            currentActiveTab = this.getAttribute('data-tab');
            document.getElementById(currentActiveTab).classList.add('active');

            updateMapLegend();
            filterAndRender(false);
        });
    });

    document.getElementById('resetFiltersBtn').addEventListener('click', function() {
        activeFilters = { status: 'all', landStatus: 'all', municipality: 'all', contractType: 'all', expiryFilter: 'all', forasStatus: 'all', forasActivity: 'all', forasSubActivity: 'all', zwaedStatus: 'all', zwaedMunicipality: 'all' };
        document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.cat-chip[data-val="all"]').forEach(c => c.classList.add('active'));

        document.getElementById('forasActivitySelect').value = 'all';
        document.getElementById('forasSubActivitySelect').value = 'all';

        document.getElementById('searchInputPoint').value = '';
        document.getElementById('searchInputPolygon').value = '';
        document.getElementById('searchInputForas').value = '';
        document.getElementById('searchInputZwaed').value = '';
        document.getElementById('searchFieldPoint').value = 'all';
        document.getElementById('searchFieldPolygon').selectedIndex = 0;
        document.getElementById('searchFieldForas').value = 'all';
        document.getElementById('searchFieldZwaed').selectedIndex = 0;
        document.getElementById('sortFieldSelect').value = 'default';
        document.getElementById('sortFieldSelectPolygon').value = 'default';
        document.getElementById('areaVal1').value = '';
        document.getElementById('areaVal2').value = '';
        document.getElementById('areaOperator').value = '=';
        document.getElementById('areaVal1Zwaed').value = '';
        document.getElementById('areaVal2Zwaed').value = '';
        document.getElementById('areaOperatorZwaed').value = '=';
        togglePolygonSearchFields();
        toggleZwaedSearchFields();

        filterAndRender(true);
    });

    function parseKML(kml, fileName) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kml, "text/xml");
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        
        allItems = [];

        Array.from(placemarks).forEach((pm, index) => {
            let item = { id: index, geometryType: 'Point' };
            
            let nameEl = pm.getElementsByTagName('name')[0];
            if (nameEl) {
                item.layerName = nameEl.textContent.trim();
            }
            
            let parentNode = pm.parentNode;
            while(parentNode && parentNode.nodeName) {
                if(parentNode.nodeName === 'Folder' || parentNode.nodeName === 'Document') {
                    let folderNameEl = parentNode.getElementsByTagName('name')[0];
                    if(folderNameEl) {
                        item.folderName = folderNameEl.textContent.trim();
                        let fNameLower = item.folderName.toLowerCase();
                        if(fNameLower === 'foras') {
                            item.isForasLayer = true;
                        } else if(fNameLower === 'zwaed') {
                            item.isZwaedLayer = true;
                        }
                    }
                }
                parentNode = parentNode.parentNode;
            }
            if (item.layerName) {
                let lNameLower = item.layerName.toLowerCase();
                if (lNameLower === 'foras') {
                    item.isForasLayer = true;
                } else if (lNameLower === 'zwaed') {
                    item.isZwaedLayer = true;
                }
            }

            for (let d of pm.getElementsByTagName('Data')) {
                let key = d.getAttribute('name');
                let valEl = d.getElementsByTagName('value')[0];
                if (key) { item[key.trim()] = valEl ? valEl.textContent.trim() : ''; }
            }

            for (let sd of pm.getElementsByTagName('SimpleData')) {
                let key = sd.getAttribute('name');
                if (key) { item[key.trim()] = sd.textContent.trim(); }
            }

            const descEl = pm.getElementsByTagName('description')[0];
            if (descEl) {
                let tempDiv = document.createElement('div');
                tempDiv.innerHTML = descEl.textContent || descEl.innerHTML;
                
                let descTextLower = tempDiv.textContent.toLowerCase();
                if (descTextLower.includes('foras')) {
                    item.isForasLayer = true;
                } else if (descTextLower.includes('zwaed')) {
                    item.isZwaedLayer = true;
                }

                tempDiv.querySelectorAll('tr').forEach(row => {
                    let cols = row.querySelectorAll('td, th');
                    if (cols.length >= 2) {
                        let k = cols[0].textContent.trim().replace(':', '');
                        let v = cols[1].textContent.trim();
                        if (k && v && !['fid', 'objectid', 'اسم العنصر'].includes(k.toLowerCase())) {
                            if (!item[k]) item[k] = v;
                        }
                    }
                });
            }

            if (item['رقم الفرصة'] || item['حالة الفرصة'] || item['النشاط الرئيسي']) {
                item.isForasLayer = true;
            }

            if (item['موعد اعلان الفرصة'] && !item['موعد اعلان الفرصة الاستثمارية']) {
                item['موعد اعلان الفرصة الاستثمارية'] = item['موعد اعلان الفرصة'];
            } else if (item['موعد اعلان الفرصة الاستثمارية'] && !item['موعد اعلان الفرصة']) {
                item['موعد اعلان الفرصة'] = item['موعد اعلان الفرصة الاستثمارية'];
            }

            if (item['حالة الفرصة'] && item['حالة الفرصة'].includes('فرصة استثمارية ملغية بسبب عدم وجود عطاءات')) {
                item['حالة الفرصة'] = 'ملغاة';
            }

            const polyCoord = pm.getElementsByTagName('coordinates')[0];
            if (polyCoord) {
                let coordsText = polyCoord.textContent.trim().split(/\s+/);
                if (coordsText.length > 1) {
                    item.geometryType = 'Polygon';
                    item.polygonCoords = coordsText.map(c => {
                        let p = c.split(',');
                        return [parseFloat(p[1]), parseFloat(p[0])];
                    });
                    item.lat = item.polygonCoords[0][0];
                    item.lng = item.polygonCoords[0][1];
                } else {
                    let parts = coordsText[0].split(',');
                    if (parts.length >= 2) { 
                        item.lng = parseFloat(parts[0]); 
                        item.lat = parseFloat(parts[1]); 
                    }
                }
            }

            if (!item.lat || !item.lng) {
                let altCoord = pm.querySelector('Polygon coordinates, LineString coordinates, LinearRing coordinates');
                if (altCoord) {
                    let coordsText = altCoord.textContent.trim().split(/\s+/);
                    if (coordsText.length > 1) {
                        item.geometryType = 'Polygon';
                        item.polygonCoords = coordsText.map(c => {
                            let p = c.split(',');
                            return [parseFloat(p[1]), parseFloat(p[0])];
                        });
                        item.lat = item.polygonCoords[0][0];
                        item.lng = item.polygonCoords[0][1];
                    } else {
                        let parts = coordsText[0].split(',');
                        if (parts.length >= 2) { 
                            item.lng = parseFloat(parts[0]); 
                            item.lat = parseFloat(parts[1]); 
                        }
                    }
                }
            }

            allItems.push(item);
        });

        saveToIndexedDB(fileName, allItems);
        buildDynamicPolygonFields();
        buildDynamicChips();
        filterAndRender(true);
    }

    function buildDynamicPolygonFields() {
        const searchFieldPolygon = document.getElementById('searchFieldPolygon');
        if (searchFieldPolygon) {
            let currentVal = searchFieldPolygon.value;
            let optionsHtml = '';
            polygonFields.forEach(f => {
                optionsHtml += `<option value="${f}">${f}</option>`;
            });
            searchFieldPolygon.innerHTML = optionsHtml;
            if (polygonFields.includes(currentVal)) {
                searchFieldPolygon.value = currentVal;
            }
        }
    }

    function buildDynamicChips() {
        const typeContainer = document.getElementById('typeChips');
        typeContainer.innerHTML = `<div class="cat-chip active" data-type="contractType" data-val="all">جميــــع العقــــــــود</div>`;
        
        const landStatusContainer = document.getElementById('landStatusChips');
        landStatusContainer.innerHTML = `<div class="cat-chip active" data-type="landStatus" data-val="all">جميع الأصول الإستثمارية</div>`;

        const municipalityContainer = document.getElementById('municipalityChips');
        if (municipalityContainer) {
            municipalityContainer.innerHTML = `<div class="cat-chip active" data-type="municipality" data-val="all">جميع البلديات</div>`;
        }

        const forasStatusContainer = document.getElementById('forasStatusChips');
        forasStatusContainer.innerHTML = `<div class="cat-chip active" data-type="forasStatus" data-val="all">جميع الفـــــرص</div>`;

        const zwaedStatusContainer = document.getElementById('zwaedStatusChips');
        if (zwaedStatusContainer) {
            zwaedStatusContainer.innerHTML = `<div class="cat-chip active" data-type="zwaedStatus" data-val="all">جميع الزوائد</div>`;
        }

        const zwaedMunicipalityContainer = document.getElementById('zwaedMunicipalityChips');
        if (zwaedMunicipalityContainer) {
            zwaedMunicipalityContainer.innerHTML = `<div class="cat-chip active" data-type="zwaedMunicipality" data-val="all">جميع البلديات</div>`;
        }

        const activitySelect = document.getElementById('forasActivitySelect');
        activitySelect.innerHTML = `<option value="all">جميع الأنشطة الرئيسية</option>`;

        const subActivitySelect = document.getElementById('forasSubActivitySelect');
        subActivitySelect.innerHTML = `<option value="all">جميع الأنشطة الفرعية</option>`;

        let uniqueTypes = new Set();
        let uniqueLandStatuses = new Set();
        let uniqueMunicipalities = new Set();
        let uniqueForasStatuses = new Set();
        let uniqueForasActivities = new Set();
        let uniqueForasSubActivities = new Set();
        let uniqueZwaedStatuses = new Set();
        let uniqueZwaedMunicipalities = new Set();

        allItems.forEach(item => {
            let t = item['نوع العقد'];
            if (t) uniqueTypes.add(t);

            let ls = item['حالة الاستثمار'];
            if (ls) {
                if (item.isZwaedLayer) uniqueZwaedStatuses.add(ls);
                else uniqueLandStatuses.add(ls);
            }

            let mun = item['البلدية'];
            if (mun) {
                uniqueMunicipalities.add(mun);
                if (item.isZwaedLayer) uniqueZwaedMunicipalities.add(mun);
            }

            if (item.isForasLayer) {
                let fs = item['حالة الفرصة'];
                if (fs) uniqueForasStatuses.add(fs);

                let fa = item['النشاط الرئيسي'];
                if (fa) uniqueForasActivities.add(fa);

                let fsa = item['النشاط الفرعي'];
                if (fsa) uniqueForasSubActivities.add(fsa);
            }
        });

        uniqueTypes.forEach(tVal => {
            let chip = document.createElement('div');
            chip.className = 'cat-chip';
            chip.setAttribute('data-type', 'contractType');
            chip.setAttribute('data-val', tVal);
            chip.textContent = tVal;
            typeContainer.appendChild(chip);
        });

        uniqueLandStatuses.forEach(lsVal => {
            let chip = document.createElement('div');
            chip.className = 'cat-chip';
            chip.setAttribute('data-type', 'landStatus');
            chip.setAttribute('data-val', lsVal);
            chip.textContent = lsVal;
            landStatusContainer.appendChild(chip);
        });

        if (municipalityContainer) {
            uniqueMunicipalities.forEach(mVal => {
                let chip = document.createElement('div');
                chip.className = 'cat-chip';
                chip.setAttribute('data-type', 'municipality');
                chip.setAttribute('data-val', mVal);
                chip.textContent = mVal;
                municipalityContainer.appendChild(chip);
            });
        }

        uniqueForasStatuses.forEach(fsVal => {
            let chip = document.createElement('div');
            chip.className = 'cat-chip';
            chip.setAttribute('data-type', 'forasStatus');
            chip.setAttribute('data-val', fsVal);
            chip.textContent = fsVal;
            forasStatusContainer.appendChild(chip);
        });

        if (zwaedStatusContainer) {
            uniqueZwaedStatuses.forEach(zsVal => {
                let chip = document.createElement('div');
                chip.className = 'cat-chip';
                chip.setAttribute('data-type', 'zwaedStatus');
                chip.setAttribute('data-val', zsVal);
                chip.textContent = zsVal;
                zwaedStatusContainer.appendChild(chip);
            });
        }

        if (zwaedMunicipalityContainer) {
            uniqueZwaedMunicipalities.forEach(zmVal => {
                let chip = document.createElement('div');
                chip.className = 'cat-chip';
                chip.setAttribute('data-type', 'zwaedMunicipality');
                chip.setAttribute('data-val', zmVal);
                chip.textContent = zmVal;
                zwaedMunicipalityContainer.appendChild(chip);
            });
        }

        uniqueForasActivities.forEach(faVal => {
            let opt = document.createElement('option');
            opt.value = faVal;
            opt.textContent = faVal;
            activitySelect.appendChild(opt);
        });

        uniqueForasSubActivities.forEach(fsaVal => {
            let opt = document.createElement('option');
            opt.value = fsaVal;
            opt.textContent = fsaVal;
            subActivitySelect.appendChild(opt);
        });

        attachChipEvents();
    }

    function attachChipEvents() {
        document.querySelectorAll('.cat-chip').forEach(chip => {
            chip.onclick = function() {
                let groupType = this.getAttribute('data-type');
                document.querySelectorAll(`.cat-chip[data-type="${groupType}"]`).forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                
                activeFilters[groupType] = this.getAttribute('data-val');
                filterAndRender(false);
            };
        });
    }

    document.getElementById('forasActivitySelect').addEventListener('change', function() {
        activeFilters.forasActivity = this.value;
        filterAndRender(false);
    });

    document.getElementById('forasSubActivitySelect').addEventListener('change', function() {
        activeFilters.forasSubActivity = this.value;
        filterAndRender(false);
    });

    document.getElementById('searchInputPoint').addEventListener('input', () => filterAndRender(false));
    document.getElementById('searchFieldPoint').addEventListener('change', () => filterAndRender(false));
    document.getElementById('searchInputPolygon').addEventListener('input', () => filterAndRender(false));
    document.getElementById('searchFieldPolygon').addEventListener('change', function() {
        togglePolygonSearchFields();
        filterAndRender(false);
    });
    document.getElementById('searchInputForas').addEventListener('input', () => filterAndRender(false));
    document.getElementById('searchFieldForas').addEventListener('change', () => filterAndRender(false));

    document.getElementById('searchInputZwaed').addEventListener('input', () => filterAndRender(false));
    document.getElementById('searchFieldZwaed').addEventListener('change', function() {
        toggleZwaedSearchFields();
        filterAndRender(false);
    });

    document.getElementById('sortFieldSelect').addEventListener('change', () => filterAndRender(false));
    document.getElementById('sortFieldSelectPolygon').addEventListener('change', () => filterAndRender(false));

    document.getElementById('areaOperator').addEventListener('change', function() {
        const val2Input = document.getElementById('areaVal2');
        if (this.value === 'between') {
            val2Input.style.display = 'block';
        } else {
            val2Input.style.display = 'none';
        }
        filterAndRender(false);
    });

    document.getElementById('areaVal1').addEventListener('input', () => filterAndRender(false));
    document.getElementById('areaVal2').addEventListener('input', () => filterAndRender(false));

    document.getElementById('areaOperatorZwaed').addEventListener('change', function() {
        const val2Input = document.getElementById('areaVal2Zwaed');
        if (this.value === 'between') {
            val2Input.style.display = 'block';
        } else {
            val2Input.style.display = 'none';
        }
        filterAndRender(false);
    });

    document.getElementById('areaVal1Zwaed').addEventListener('input', () => filterAndRender(false));
    document.getElementById('areaVal2Zwaed').addEventListener('input', () => filterAndRender(false));

    function togglePolygonSearchFields() {
        const field = document.getElementById('searchFieldPolygon').value;
        const normalGroup = document.getElementById('normalSearchGroupPolygon');
        const areaGroup = document.getElementById('areaSearchGroupPolygon');

        if (field === 'SHAPE_Area') {
            normalGroup.style.display = 'none';
            areaGroup.style.display = 'flex';
        } else {
            normalGroup.style.display = 'flex';
            areaGroup.style.display = 'none';
        }
    }

    function toggleZwaedSearchFields() {
        const field = document.getElementById('searchFieldZwaed').value;
        const normalGroup = document.getElementById('normalSearchGroupZwaed');
        const areaGroup = document.getElementById('areaSearchGroupZwaed');

        if (field === 'SHAPE_Area') {
            normalGroup.style.display = 'none';
            areaGroup.style.display = 'flex';
        } else {
            normalGroup.style.display = 'flex';
            areaGroup.style.display = 'none';
        }
    }

    function getDaysUntilExpiry(dateStr) {
        if (!dateStr) return null;
        let parts = dateStr.split(/[-/]/);
        let expiryDate;
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                expiryDate = new Date(parts[0], parts[1]-1, parts[2]);
            } else {
                expiryDate = new Date(parts[2], parts[1]-1, parts[0]);
            }
        } else {
            expiryDate = new Date(dateStr);
        }
        if (isNaN(expiryDate)) return null;
        let today = new Date();
        let diffTime = expiryDate - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    function filterAndRender(fitBounds = false) {
        const filtered = allItems.filter(item => {
            if (currentActiveTab === 'tabPoints') {
                if (item.geometryType !== 'Point' || item.isForasLayer || item.isZwaedLayer) return false;

                if (activeFilters.expiryFilter && activeFilters.expiryFilter !== 'all') {
                    let days = getDaysUntilExpiry(item['تاريخ نهاية العقد']);
                    if (days === null) return false;
                    if (activeFilters.expiryFilter === '30' && (days < 0 || days > 30)) return false;
                    if (activeFilters.expiryFilter === '60' && (days < 31 || days > 60)) return false;
                    if (activeFilters.expiryFilter === '90' && (days < 61 || days > 90)) return false;
                } else {
                    if (activeFilters.status !== 'all') {
                        let statusVal = String(item['حالة سريان العقد'] || '').toLowerCase();
                        if (!statusVal.includes(activeFilters.status.toLowerCase())) return false;
                    }
                }

                if (activeFilters.contractType !== 'all') {
                    let typeVal = String(item['نوع العقد'] || '').trim();
                    if (typeVal !== activeFilters.contractType) return false;
                }

                const query = document.getElementById('searchInputPoint').value.toLowerCase().trim();
                const searchField = document.getElementById('searchFieldPoint').value;
                if (query) {
                    if (searchField === 'all') {
                        return Object.entries(item).some(([k, val]) => 
                            !['id', 'lat', 'lng', 'polygonCoords', 'geometryType'].includes(k) && String(val).toLowerCase().includes(query)
                        );
                    } else {
                        let val = item[searchField] || '';
                        return String(val).toLowerCase().includes(query);
                    }
                }
                return true;

            } else if (currentActiveTab === 'tabPolygons') {
                if (item.geometryType !== 'Polygon' || item.isZwaedLayer) return false;

                if (activeFilters.landStatus !== 'all') {
                    let landVal = String(item['حالة الاستثمار'] || '').trim();
                    if (landVal !== activeFilters.landStatus) return false;
                }

                if (activeFilters.municipality !== 'all') {
                    let munVal = String(item['البلدية'] || '').trim();
                    if (munVal !== activeFilters.municipality) return false;
                }

                const searchField = document.getElementById('searchFieldPolygon').value;
                if (searchField === 'SHAPE_Area') {
                    let areaStr = item['SHAPE_Area'] || '0';
                    let itemArea = parseFloat(areaStr.toString().replace(/[^0-9.-]+/g, ""));
                    if (isNaN(itemArea)) return false;

                    let op = document.getElementById('areaOperator').value;
                    let v1 = parseFloat(document.getElementById('areaVal1').value);
                    let v2 = parseFloat(document.getElementById('areaVal2').value);

                    if (!isNaN(v1)) {
                        if (op === '=' && itemArea !== v1) return false;
                        if (op === '<' && itemArea >= v1) return false;
                        if (op === '>' && itemArea <= v1) return false;
                        if (op === 'between' && !isNaN(v2)) {
                            let min = Math.min(v1, v2);
                            let max = Math.max(v1, v2);
                            if (itemArea < min || itemArea > max) return false;
                        }
                    }
                    return true;
                } else {
                    const query = document.getElementById('searchInputPolygon').value.toLowerCase().trim();
                    if (query) {
                        let val = item[searchField] || '';
                        return String(val).toLowerCase().includes(query);
                    }
                    return true;
                }
            } else if (currentActiveTab === 'tabForas') {
                if (!item.isForasLayer) return false;

                if (activeFilters.forasStatus !== 'all') {
                    let fsVal = String(item['حالة الفرصة'] || '').trim();
                    if (fsVal !== activeFilters.forasStatus) return false;
                }

                if (activeFilters.forasActivity !== 'all') {
                    let faVal = String(item['النشاط الرئيسي'] || '').trim();
                    if (faVal !== activeFilters.forasActivity) return false;
                }

                if (activeFilters.forasSubActivity !== 'all') {
                    let fsaVal = String(item['النشاط الفرعي'] || '').trim();
                    if (fsaVal !== activeFilters.forasSubActivity) return false;
                }

                const query = document.getElementById('searchInputForas').value.toLowerCase().trim();
                const searchField = document.getElementById('searchFieldForas').value;
                if (query) {
                    if (searchField === 'all') {
                        return Object.entries(item).some(([k, val]) => 
                            !['id', 'lat', 'lng', 'polygonCoords', 'geometryType'].includes(k) && String(val).toLowerCase().includes(query)
                        );
                    } else {
                        let val = item[searchField] || '';
                        return String(val).toLowerCase().includes(query);
                    }
                }
                return true;
            } else if (currentActiveTab === 'tabZwaed') {
                if (!item.isZwaedLayer) return false;

                if (activeFilters.zwaedStatus !== 'all') {
                    let zsVal = String(item['حالة الاستثمار'] || '').trim();
                    if (zsVal !== activeFilters.zwaedStatus) return false;
                }

                if (activeFilters.zwaedMunicipality !== 'all') {
                    let zmVal = String(item['البلدية'] || '').trim();
                    if (zmVal !== activeFilters.zwaedMunicipality) return false;
                }

                const searchField = document.getElementById('searchFieldZwaed').value;
                if (searchField === 'SHAPE_Area') {
                    let areaStr = item['SHAPE_Area'] || '0';
                    let itemArea = parseFloat(areaStr.toString().replace(/[^0-9.-]+/g, ""));
                    if (isNaN(itemArea)) return false;

                    let op = document.getElementById('areaOperatorZwaed').value;
                    let v1 = parseFloat(document.getElementById('areaVal1Zwaed').value);
                    let v2 = parseFloat(document.getElementById('areaVal2Zwaed').value);

                    if (!isNaN(v1)) {
                        if (op === '=' && itemArea !== v1) return false;
                        if (op === '<' && itemArea >= v1) return false;
                        if (op === '>' && itemArea <= v1) return false;
                        if (op === 'between' && !isNaN(v2)) {
                            let min = Math.min(v1, v2);
                            let max = Math.max(v1, v2);
                            if (itemArea < min || itemArea > max) return false;
                        }
                    }
                    return true;
                } else {
                    const query = document.getElementById('searchInputZwaed').value.toLowerCase().trim();
                    if (query) {
                        let val = item[searchField] || '';
                        return String(val).toLowerCase().includes(query);
                    }
                    return true;
                }
            }
        });

        const sortVal = currentActiveTab === 'tabPoints' ? document.getElementById('sortFieldSelect').value : (currentActiveTab === 'tabPolygons' ? document.getElementById('sortFieldSelectPolygon').value : 'default');
        if (sortVal !== 'default') {
            filtered.sort((a, b) => {
                if (sortVal === 'valueDesc' || sortVal === 'valueAsc') {
                    let valA = parseFloat(String(a['القيمة السنوية للعقد'] || a['القيمة السنوية للعقد شاملة ضريبة القيمة المضافة'] || '0').replace(/[^0-9.-]+/g, ""));
                    let valB = parseFloat(String(b['القيمة السنوية للعقد'] || b['القيمة السنوية للعقد شاملة ضريبة القيمة المضافة'] || '0').replace(/[^0-9.-]+/g, ""));
                    return sortVal === 'valueDesc' ? valB - valA : valA - valB;
                } else if (sortVal === 'expirySoon') {
                    let daysA = getDaysUntilExpiry(a['تاريخ نهاية العقد']) ?? 99999;
                    let daysB = getDaysUntilExpiry(b['تاريخ نهاية العقد']) ?? 99999;
                    return daysA - daysB;
                } else if (sortVal === 'investor') {
                    let invA = String(a['اسم المستثمر'] || '');
                    let invB = String(b['اسم المستثمر'] || '');
                    return invA.localeCompare(invB, 'ar');
                } else if (sortVal === 'areaDesc' || sortVal === 'areaAsc') {
                    let areaA = parseFloat(String(a['SHAPE_Area'] || '0').replace(/[^0-9.-]+/g, ""));
                    let areaB = parseFloat(String(b['SHAPE_Area'] || '0').replace(/[^0-9.-]+/g, ""));
                    return sortVal === 'areaDesc' ? areaB - areaA : areaA - areaB;
                } else if (sortVal === 'plotNo') {
                    let pA = String(a['رقم قطعة الأرض من المخطط'] || '');
                    let pB = String(b['رقم قطعة الأرض من المخطط'] || '');
                    return pA.localeCompare(pB, 'ar');
                }
                return 0;
            });
        }

        currentFilteredItems = filtered; 

        updateKPIs(filtered); 
        renderResultsList(filtered);
        renderMapMarkers(filtered, fitBounds);
    }

    function updateKPIs(items) {
        const kpiContainer = document.getElementById('kpiContainer');
        
        if (currentActiveTab === 'tabPoints') {
            let totalPointCount = items.filter(item => item.geometryType === 'Point' && !item.isForasLayer && !item.isZwaedLayer).length;
            let sariCount = 0;
            let muntahiCount = 0;
            let totalValue = 0;
            let exp30Count = 0;
            let exp60Count = 0;
            let exp90Count = 0;

            items.forEach(item => {
                if (item.geometryType === 'Point' && !item.isForasLayer && !item.isZwaedLayer) {
                    let status = String(item['حالة سريان العقد'] || '').toLowerCase();
                    if (status.includes('ساري')) {
                        sariCount++;
                    } else if (status.includes('منتهي')) {
                        muntahiCount++;
                    }

                    let days = getDaysUntilExpiry(item['تاريخ نهاية العقد']);
                    if (days !== null && days >= 0) {
                        if (days <= 30) exp30Count++;
                        else if (days <= 60) exp60Count++;
                        else if (days <= 90) exp90Count++;
                    }

                    let valStr = item['القيمة السنوية للعقد'] || item['القيمة السنوية للعقد شاملة ضريبة القيمة المضافة'] || '0';
                    let cleanVal = parseFloat(valStr.toString().replace(/[^0-9.-]+/g, ""));
                    if (!isNaN(cleanVal)) {
                        totalValue += cleanVal;
                    }
                }
            });

            kpiContainer.innerHTML = `
                <div class="kpi-card">
                    <span class="kpi-title">إجمالــي العقـــــــود</span>
                    <span class="kpi-value">${totalPointCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card sari">
                    <span class="kpi-title">عقـــــود ساريـــة</span>
                    <span class="kpi-value">${sariCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card muntahi">
                    <span class="kpi-title">عقـــــود منتهيـــة</span>
                    <span class="kpi-value">${muntahiCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card exp-30" style="cursor: pointer;" onclick="filterByExpiry('30')" title="انقر لتصفية العقود التي تنتهي خلال 30 يوم">
                    <span class="kpi-title">تنتهي بـ 30 يوم</span>
                    <span class="kpi-value">${exp30Count.toLocaleString()}</span>
                </div>
                <div class="kpi-card exp-60" style="cursor: pointer;" onclick="filterByExpiry('60')" title="انقر لتصفية العقود التي تنتهي خلال 60 يوم">
                    <span class="kpi-title">تنتهي بـ 60 يوم</span>
                    <span class="kpi-value">${exp60Count.toLocaleString()}</span>
                </div>
                <div class="kpi-card exp-90" style="cursor: pointer;" onclick="filterByExpiry('90')" title="انقر لتصفية العقود التي تنتهي خلال 90 يوم">
                    <span class="kpi-title">تنتهي بـ 90 يوم</span>
                    <span class="kpi-value">${exp90Count.toLocaleString()}</span>
                </div>
                <div class="kpi-card total-val">
                    <span class="kpi-title">إجمالي القيمة (ريال)</span>
                    <span class="kpi-value">${totalValue.toLocaleString()}</span>
                </div>
            `;
        } else if (currentActiveTab === 'tabPolygons') {
            let polygons = items.filter(item => item.geometryType === 'Polygon' && !item.isZwaedLayer);
            let totalPolygonCount = polygons.length;
            let contractedCount = 0;
            let emptyCount = 0;
            let parkCount = 0;
            let totalArea = 0;

            polygons.forEach(item => {
                let landStatus = String(item['حالة الاستثمار'] || '').trim();
                if (landStatus.includes('أصل عليه عقد')) {
                    contractedCount++;
                } else if (landStatus.includes('أصل شاغر')) {
                    emptyCount++;
                } else if (landStatus.includes('حديقة')) {
                    parkCount++;
                }

                let areaStr = item['SHAPE_Area'] || '0';
                let cleanArea = parseFloat(areaStr.toString().replace(/[^0-9.-]+/g, ""));
                if (!isNaN(cleanArea)) {
                    totalArea += cleanArea;
                }
            });

            kpiContainer.innerHTML = `
                <div class="kpi-card">
                    <span class="kpi-title">إجمالي عدد الأصول</span>
                    <span class="kpi-value">${totalPolygonCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card sari">
                    <span class="kpi-title">أصول عليها عقود</span>
                    <span class="kpi-value">${contractedCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card">
                    <span class="kpi-title">أصل شاغر</span>
                    <span class="kpi-value">${emptyCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card park">
                    <span class="kpi-title">الحدائق الاستثمارية</span>
                    <span class="kpi-value">${parkCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card total-val">
                    <span class="kpi-title">إجمالي المساحة (م²)</span>
                    <span class="kpi-value">${Math.round(totalArea).toLocaleString()}</span>
                </div>
            `;
        } else if (currentActiveTab === 'tabForas') {
            let forasItems = items.filter(item => item.isForasLayer);
            let totalForasCount = forasItems.length;

            let announcedCount = 0;
            let canceledCount = 0;
            let newCount = 0;
            let nullCount = 0;

            forasItems.forEach(item => {
                let fs = String(item['حالة الفرصة'] || '').trim();
                if (fs.includes('معلنة')) {
                    announcedCount++;
                } else if (fs.includes('ملغاة')) {
                    canceledCount++;
                } else if (fs.includes('جديد') || fs.includes('جديدة')) {
                    newCount++;
                } else {
                    nullCount++;
                }
            });

            kpiContainer.innerHTML = `
                <div class="kpi-card">
                    <span class="kpi-title">إجمالي الفرص</span>
                    <span class="kpi-value">${totalForasCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card" style="border-right-color: #059669;">
                    <span class="kpi-title">معلنة</span>
                    <span class="kpi-value">${announcedCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card" style="border-right-color: #dc2626;">
                    <span class="kpi-title">ملغاة</span>
                    <span class="kpi-value">${canceledCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card" style="border-right-color: #2563eb;">
                    <span class="kpi-title">جديد</span>
                    <span class="kpi-value">${newCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card" style="border-right-color: #71717a;">
                    <span class="kpi-title">null / غير مصنف</span>
                    <span class="kpi-value">${nullCount.toLocaleString()}</span>
                </div>
            `;
        } else if (currentActiveTab === 'tabZwaed') {
            let zwaedItems = items.filter(item => item.isZwaedLayer);
            let totalZwaedCount = zwaedItems.length;
            let planningCount = 0;
            let expropriationCount = 0;
            let totalArea = 0;

            zwaedItems.forEach(item => {
                let zStatus = String(item['حالة الاستثمار'] || '').trim();
                if (zStatus.includes('تخطيطية')) {
                    planningCount++;
                } else if (zStatus.includes('نزع')) {
                    expropriationCount++;
                }

                let areaStr = item['SHAPE_Area'] || '0';
                let cleanArea = parseFloat(areaStr.toString().replace(/[^0-9.-]+/g, ""));
                if (!isNaN(cleanArea)) {
                    totalArea += cleanArea;
                }
            });

            kpiContainer.innerHTML = `
                <div class="kpi-card">
                    <span class="kpi-title">إجمالي الزوائد</span>
                    <span class="kpi-value">${totalZwaedCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card" style="border-right-color: #8b5cf6;">
                    <span class="kpi-title">زوائد تخطيطية</span>
                    <span class="kpi-value">${planningCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card" style="border-right-color: #F20000;">
                    <span class="kpi-title">زوائد نزع</span>
                    <span class="kpi-value">${expropriationCount.toLocaleString()}</span>
                </div>
                <div class="kpi-card total-val">
                    <span class="kpi-title">إجمالي مساحة الزوائد (م²)</span>
                    <span class="kpi-value">${Math.round(totalArea).toLocaleString()}</span>
                </div>
            `;
        }
    }

    function filterByExpiry(daysVal) {
        activeFilters.expiryFilter = activeFilters.expiryFilter === daysVal ? 'all' : daysVal;
        filterAndRender(false);
    }

    function renderResultsList(items) {
        let listId = 'resultsList';
        let countId = 'resultCount';

        if (currentActiveTab === 'tabPolygons') {
            listId = 'resultsListPolygon';
            countId = 'resultCountPolygon';
        } else if (currentActiveTab === 'tabForas') {
            listId = 'resultsListForas';
            countId = 'resultCountForas';
        } else if (currentActiveTab === 'tabZwaed') {
            listId = 'resultsListZwaed';
            countId = 'resultCountZwaed';
        }
        
        const list = document.getElementById(listId);
        const countEl = document.getElementById(countId);
        
        if (countEl) countEl.textContent = items.length;
        if (!list) return;
        
        list.innerHTML = '';

        if (items.length === 0) {
            list.innerHTML = '<div style="padding: 8px; text-align: center; color: var(--text-color); opacity: 0.6; font-size: 0.75rem;">لا توجد نتائج مطابقة في هذا القسم</div>';
            return;
        }

        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'result-item';
            
            let titleKey = item.geometryType === 'Point' ? (item.isForasLayer ? 'رقم الفرصة' : 'رقم العقد') : 'رقم قطعة الأرض من المخطط';
            let contractNo = item[titleKey] || item['رقم الفرصة'] || 'عنصر استثماري';
            let extraInfo = item.geometryType === 'Point' && !item.isForasLayer && !item.isZwaedLayer && item['اسم المستثمر'] ? ' - ' + item['اسم المستثمر'] : (item.isForasLayer && item['النشاط الرئيسي'] ? ' - ' + item['النشاط الرئيسي'] : (item.isZwaedLayer && item['البلدية'] ? ' - ' + item['البلدية'] : ''));
            let status = item['حالة سريان العقد'] || item['حالة الاستثمار'] || item['حالة الفرصة'] || 'غير متاح';

            let badgeClass = 'status-other';
            if (status.includes('ساري') || status.includes('أصل عليه عقد') || status.includes('متاحة')) badgeClass = 'status-sari';
            else if (status.includes('منتهي') || status.includes('أصل شاغر')) badgeClass = 'status-muntahi';

            div.innerHTML = `<span>${contractNo}${extraInfo} (${item.geometryType})</span> <span class="status-badge ${badgeClass}">${status}</span>`;
            
            div.onclick = () => {
                document.querySelectorAll('.result-item').forEach(el => el.classList.remove('active'));
                div.classList.add('active');
                showContractDetails(item);
                if (item.lat && item.lng) { map.setView([item.lat, item.lng], 16); }
            };
            list.appendChild(div);
        });
    }

    function renderMapMarkers(items, fitBounds = false) {
        markersLayer.clearLayers();
        let bounds = [];

        let coordGroups = {};
        items.forEach(item => {
            if (item.geometryType === 'Point' && item.lat && item.lng) {
                let key = `${item.lat.toFixed(6)}_${item.lng.toFixed(6)}`;
                if (!coordGroups[key]) coordGroups[key] = [];
                coordGroups[key].push(item);
            }
        });

        items.forEach(item => {
            let status = String(item['حالة سريان العقد'] || item['حالة الاستثمار'] || item['حالة الفرصة'] || '');
            let markerColor = '#0f766e'; 
            let fillColor = '#0f766e';

            if (item.isZwaedLayer) {
                let zStatus = String(item['حالة الاستثمار'] || '').trim();
                if (zStatus.includes('تخطيطية')) {
                    markerColor = '#8b5cf6'; // بنفسجي للزوائد التخطيطية
                    fillColor = '#8b5cf6';
                } else if (zStatus.includes('نزع')) {
                    markerColor = '#F20000'; // أحمر لزوائد النزع
                    fillColor = '#F20000';
                } else {
                    markerColor = '#8b5cf6';
                    fillColor = '#8b5cf6';
                }
            } else if (item.geometryType === 'Polygon') {
                if (status.includes('أصل شاغر')) {
                    markerColor = '#dc2626'; 
                    fillColor = '#dc2626';   
                } else if (status.includes('أصل عليه عقد')) {
                    markerColor = '#2563eb'; 
                    fillColor = '#3b82f6';   
                } else if (status.includes('حديقة')) {
                    markerColor = '#16a34a'; 
                    fillColor = '#22c55e';   
                }
            } else {
                if (item.isForasLayer) {
                    let fs = String(item['حالة الفرصة'] || '').trim();
                    if (fs.includes('معلنة')) {
                        markerColor = '#059669'; 
                        fillColor = '#059669';
                    } else if (fs.includes('ملغاة')) {
                        markerColor = '#dc2626'; 
                        fillColor = '#dc2626';
                    } else if (fs.includes('جديد') || fs.includes('جديدة')) {
                        markerColor = '#2563eb'; 
                        fillColor = '#2563eb';
                    } else {
                        markerColor = '#F2B02C'; 
                        fillColor = '#71717a';
                    }
                } else {
                    if (status.includes('ساري')) markerColor = '#059669'; 
                    else if (status.includes('منتهي')) markerColor = '#dc2626'; 
                }
            }

            let fieldsToUse = item.geometryType === 'Point' ? (item.isForasLayer ? forasFields : pointFields) : (item.isZwaedLayer ? zwaedFields : polygonFields);
            let titleVal = item.geometryType === 'Point' ? (item.isForasLayer ? (item['رقم الفرصة'] || 'فرصة استثمارية') : (item['رقم العقد'] || 'عقد استثماري')) : (item['رقم قطعة الأرض من المخطط'] || 'أصل استثماري');

            function getPopupHtmlForPoint(targetItem, groupList) {
                let currentTitle = targetItem.geometryType === 'Point' ? (targetItem.isForasLayer ? (targetItem['رقم الفرصة'] || 'فرصة استثمارية') : (targetItem['رقم العقد'] || 'عقد استثماري')) : (targetItem['رقم قطعة الأرض من المخطط'] || 'أصل استثماري');
                let html = `<h4>${currentTitle} (${targetItem.geometryType})</h4>`;
                
                if (groupList && groupList.length > 1) {
                    html += `<div style="margin-bottom: 6px; padding: 4px; background: #e2e8f0; border-radius: 6px; font-size: 0.72rem; font-weight: bold; text-align: center;">يوجد (${groupList.length}) عناصر في هذا الموقع (اختر العنصر للتصفح):</div>`;
                    html += `<div style="display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; max-height: 60px; overflow-y: auto;">`;
                    groupList.forEach((gItem, idx) => {
                        let isSelected = gItem === targetItem;
                        let btnBg = isSelected ? '#023059' : '#D6B87E';
                        let btnColor = isSelected ? '#D6B87E' : '#023059';
                        let gTitle = gItem['رقم العقد'] || gItem['رقم الفرصة'] || (`عنصر ${idx+1}`);
                        html += `<button class="action-chip-btn" style="padding: 2px 6px; font-size: 0.65rem; background: ${btnBg}; color: ${btnColor}; border: 1px solid #023059;" onclick="window.selectGroupItem(${targetItem.id}, ${gItem.id})">عقد: ${gTitle}</button>`;
                    });
                    html += `</div>`;
                }

                html += `<table style="width:100%; font-size:0.75rem; border-collapse:collapse;">`;
                fieldsToUse.forEach(key => {
                    let val = targetItem[key] !== undefined && targetItem[key] !== '' ? targetItem[key] : '-';
                    html += `<tr><td style="border:1px solid #cbd5e1; padding:3px; font-weight:bold; background:#f1f5f9; width:45%;"><strong>${key}</strong></td><td style="border:1px solid #cbd5e1; padding:3px;">${val}</td></tr>`;
                });
                html += `</table>`;
                
                if (targetItem.lat && targetItem.lng) {
                    html += `
                        <div style="display: flex; gap: 6px; margin-top: 8px;">
                            <a href="https://www.google.com/maps/search/?api=1&query=${targetItem.lat},${targetItem.lng}" target="_blank" class="action-chip-btn map-btn google" style="flex: 1; padding: 6px 8px; font-size: 0.75rem; text-decoration: none; text-align: center; justify-content: center;" title="فتح الموقع في جوجل ماب">Google Map</a>
                            <a href="https://earth.google.com/web/@${targetItem.lat},${targetItem.lng},100a,3500d,35y,0h,0t,0r" target="_blank" class="action-chip-btn map-btn" style="flex: 1; padding: 6px 8px; font-size: 0.75rem; text-decoration: none; text-align: center; justify-content: center;" title="فتح الموقع في جوجل إيرث">google Earth</a>
                        </div>
                    `;
                }
                return html;
            }

            let popupContent = `<h4>${titleVal}</h4>`;
            popupContent += `<table style="width:100%; font-size:0.75rem; border-collapse:collapse;">`;
            fieldsToUse.forEach(key => {
                let val = item[key] !== undefined && item[key] !== '' ? item[key] : '-';
                popupContent += `<tr><td style="border:1px solid #cbd5e1; padding:3px; font-weight:bold; background:#f1f5f9; width:45%;"><strong>${key}</strong></td><td style="border:1px solid #cbd5e1; padding:3px;">${val}</td></tr>`;
            });
            popupContent += `</table>`;
            
            if (item.geometryType === 'Point' && item.lat && item.lng) {
                popupContent += `
                    <div style="display: flex; gap: 6px; margin-top: 8px;">
                        <a href="https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}" target="_blank" class="action-chip-btn map-btn google" style="flex: 1; padding: 6px 8px; font-size: 0.75rem; text-decoration: none; text-align: center; justify-content: center;" title="فتح الموقع في جوجل ماب">Google Map</a>
                        <a href="https://earth.google.com/web/@${item.lat},${item.lng},100a,3500d,35y,0h,0t,0r" target="_blank" class="action-chip-btn map-btn" style="flex: 1; padding: 6px 8px; font-size: 0.75rem; text-decoration: none; text-align: center; justify-content: center;" title="فتح الموقع في جوجل إيرث">google Earth</a>
                    </div>
                `;
            }

            if (item.geometryType === 'Polygon' && item.polygonCoords) {
                let polygon = L.polygon(item.polygonCoords, { color: markerColor, weight: 3, fillColor: fillColor, fillOpacity: 0.35, renderer: canvasRenderer });
                polygon.bindPopup(popupContent, {maxWidth: 320});
                polygon.on('click', () => { showContractDetails(item); });
                markersLayer.addLayer(polygon);
                
                if (item.polygonCoords.length > 0) {
                    item.polygonCoords.forEach(c => bounds.push(c));
                }
            } else if (item.lat && item.lng) {
                let renderLat = item.lat;
                let renderLng = item.lng;
                let key = `${item.lat.toFixed(6)}_${item.lng.toFixed(6)}`;
                let group = coordGroups[key] || [item];

                if (group.length > 1) {
                    let indexInGroup = group.indexOf(item);
                    let angle = (indexInGroup / group.length) * 2 * Math.PI;
                    let radius = 0.00005;
                    renderLat = item.lat + (radius * Math.cos(angle));
                    renderLng = item.lng + (radius * Math.sin(angle));

                    let leaderLine = L.polyline([[item.lat, item.lng], [renderLat, renderLng]], {
                        color: 'blue',
                        weight: 1.5,
                        dashArray: '3, 3',
                        opacity: 0.8
                    });
                    markersLayer.addLayer(leaderLine);
                }

                let customIcon = L.divIcon({
                    className: 'custom-map-marker',
                    html: `<div style="background-color: ${markerColor}; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`
                });

                let marker = L.marker([renderLat, renderLng], { icon: customIcon, renderer: canvasRenderer });
                let detailedPopup = getPopupHtmlForPoint(item, group);
                marker.bindPopup(detailedPopup, {maxWidth: 320});
                
                marker.on('click', () => { 
                    showContractDetails(item); 
                });

                markersLayer.addLayer(marker);
                bounds.push([renderLat, renderLng]);
            }
        });

        if (fitBounds && bounds.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
    }

    window.selectGroupItem = function(currentMarkerId, targetItemId) {
        let targetItem = allItems.find(i => i.id === targetItemId);
        if (targetItem) {
            showContractDetails(targetItem);
            let key = `${targetItem.lat.toFixed(6)}_${targetItem.lng.toFixed(6)}`;
            let group = allItems.filter(i => i.geometryType === 'Point' && i.lat && i.lng && Math.abs(i.lat - targetItem.lat) < 0.00001 && Math.abs(i.lng - targetItem.lng) < 0.00001);
            
            markersLayer.eachLayer(layer => {
                if (layer instanceof L.Marker && layer.getLatLng()) {
                    let ll = layer.getLatLng();
                    let distance = Math.hypot(ll.lat - targetItem.lat, ll.lng - targetItem.lng);
                    if (distance < 0.001) {
                        let fieldsToUse = targetItem.isForasLayer ? forasFields : pointFields;
                        let currentTitle = targetItem.isForasLayer ? (targetItem['رقم الفرصة'] || 'فرصة استثمارية') : (targetItem['رقم العقد'] || 'عقد استثماري');
                        let html = `<h4>${currentTitle} (${targetItem.geometryType})</h4>`;
                        
                        if (group.length > 1) {
                            html += `<div style="margin-bottom: 6px; padding: 4px; background: #e2e8f0; border-radius: 6px; font-size: 0.72rem; font-weight: bold; text-align: center;">يوجد (${group.length}) عناصر في هذا الموقع (اختر العنصر للتصفح):</div>`;
                            html += `<div style="display: flex; gap: 4px; margin-bottom: 8px; flex-wrap: wrap; max-height: 60px; overflow-y: auto;">`;
                            group.forEach((gItem, idx) => {
                                let isSelected = gItem === targetItem;
                                let btnBg = isSelected ? '#023059' : '#D6B87E';
                                let btnColor = isSelected ? '#D6B87E' : '#023059';
                                let gTitle = gItem['رقم العقد'] || gItem['رقم الفرصة'] || (`عنصر ${idx+1}`);
                                html += `<button class="action-chip-btn" style="padding: 2px 6px; font-size: 0.65rem; background: ${btnBg}; color: ${btnColor}; border: 1px solid #023059;" onclick="window.selectGroupItem(${targetItem.id}, ${gItem.id})">عقد: ${gTitle}</button>`;
                            });
                            html += `</div>`;
                        }

                        html += `<table style="width:100%; font-size:0.75rem; border-collapse:collapse;">`;
                        fieldsToUse.forEach(key => {
                            let val = targetItem[key] !== undefined && targetItem[key] !== '' ? targetItem[key] : '-';
                            html += `<tr><td style="border:1px solid #cbd5e1; padding:3px; font-weight:bold; background:#f1f5f9; width:45%;"><strong>${key}</strong></td><td style="border:1px solid #cbd5e1; padding:3px;">${val}</td></tr>`;
                        });
                        html += `</table>`;
                        
                        if (targetItem.lat && targetItem.lng) {
                            html += `
                                <div style="display: flex; gap: 6px; margin-top: 8px;">
                                    <a href="https://www.google.com/maps/search/?api=1&query=${targetItem.lat},${targetItem.lng}" target="_blank" class="action-chip-btn map-btn google" style="flex: 1; padding: 6px 8px; font-size: 0.75rem; text-decoration: none; text-align: center; justify-content: center;" title="فتح الموقع في جوجل ماب">Google Map</a>
                                    <a href="https://earth.google.com/web/@${targetItem.lat},${targetItem.lng},100a,3500d,35y,0h,0t,0r" target="_blank" class="action-chip-btn map-btn" style="flex: 1; padding: 6px 8px; font-size: 0.75rem; text-decoration: none; text-align: center; justify-content: center;" title="فتح الموقع في جوجل إيرث">google Earth</a>
                                </div>
                            `;
                        }
                        layer.setPopupContent(html);
                    }
                }
            });
        }
    };

    function showContractDetails(item) {
        selectedItemForDetails = item;
        const detailsContainer = document.getElementById('contractDetails');
        
        let fieldsToUse = item.geometryType === 'Point' ? (item.isForasLayer ? forasFields : pointFields) : (item.isZwaedLayer ? zwaedFields : polygonFields);
        let titleVal = item.geometryType === 'Point' ? (item.isForasLayer ? (item['رقم الفرصة'] || 'تفاصيل الفرصة الاستثمارية') : (item['رقم العقد'] || 'تفاصيل العقد الاستثماري')) : (item['رقم قطعة الأرض من المخطط'] || 'تفاصيل الأصل الاستثماري');

        let html = `
            <div class="details-header">
                <h3>${titleVal} ${item.geometryType === 'Polygon' ? '' : '(' + item.geometryType + ')'}</h3>
                <div style="display: flex; gap: 4px;">
                    <button class="action-chip-btn" id="printDetailsBtn" style="padding: 4px 8px; font-size: 0.7rem;" title="طباعة تفاصيل العنصر PDF" onclick="printDetails()">
                        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                        طباعة / PDF
                    </button>
                </div>
            </div>
            <table class="details-table">
        `;

        fieldsToUse.forEach(key => {
            let val = item[key] !== undefined && item[key] !== '' ? item[key] : '-';
            html += `<tr><td class="label">${key}</td><td>${val}</td></tr>`;
        });

        html += `</table>`;

        if (item.lat && item.lng) {
            html += `
                <div style="display: flex; gap: 6px; margin-top: 10px;">
                    <a href="https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}" target="_blank" class="action-chip-btn map-btn google" style="flex: 1; padding: 8px; font-size: 0.78rem; text-decoration: none; text-align: center; justify-content: center;" title="فتح الموقع في جوجل ماب">Google Map</a>
                    <a href="https://earth.google.com/web/@${item.lat},${item.lng},100a,3500d,35y,0h,0t,0r" target="_blank" class="action-chip-btn map-btn" style="flex: 1; padding: 8px; font-size: 0.78rem; text-decoration: none; text-align: center; justify-content: center;" title="فتح الموقع في جوجل إيرث">Google Earth</a>
                </div>
            `;
        }

        detailsContainer.innerHTML = html;
    }

    function printDetails() {
        if (!selectedItemForDetails) {
            alert('الرجاء اختيار عنصر أولاً');
            return;
        }
        let printWindow = window.open('', '_blank');
        let item = selectedItemForDetails;
        let fieldsToUse = item.geometryType === 'Point' ? (item.isForasLayer ? forasFields : pointFields) : (item.isZwaedLayer ? zwaedFields : polygonFields);
        let titleVal = item.geometryType === 'Point' ? (item.isForasLayer ? (item['رقم الفرصة'] || 'تفاصيل الفرصة الاستثمارية') : (item['رقم العقد'] || 'تفاصيل العقد الاستثماري')) : (item['رقم قطعة الأرض من المخطط'] || 'تفاصيل الأصل الاستثماري');

        let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تفاصيل العنصر</title><style>body{font-family:'Cairo',sans-serif;padding:20px;color:#023059;}table{width:100%;border-collapse:collapse;margin-top:15px;font-size:13px;}td{border:1px solid #A68365;padding:8px;background:#ECF5FE;color:#023059;} .label{font-weight:900;background:#ECF5FE;width:45%;}h2{text-align:center;color:#023059;}</style></head><body>`;
        html += `<h2>وكالة التخصيص والإستدامة المالية - ${titleVal} ${item.geometryType === 'Polygon' ? '' : '(' + item.geometryType + ')'}</h2>`;
        html += `<table>`;
        fieldsToUse.forEach(key => {
            let val = item[key] !== undefined && item[key] !== '' ? item[key] : '-';
            html += `<tr><td class="label">${key}</td><td>${val}</td></tr>`;
        });
        html += `</table></body></html>`;

        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
    }

    // Modal and Chart logic
    const chartModal = document.getElementById('chartModal');
    const exportChartDropdown = document.getElementById('exportChartDropdown');

    document.getElementById('openChartModalBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        exportChartDropdown.classList.toggle('active');
    });

    window.addEventListener('click', () => {
        exportChartDropdown.classList.remove('active');
    });

    function openChartCategory(cat) {
        exportChartDropdown.classList.remove('active');
        chartModal.style.display = 'flex';
        currentChartType = cat;

        const pointsSub = document.getElementById('pointsChartSubButtons');
        const polygonsSub = document.getElementById('polygonsChartSubButtons');
        const forasSub = document.getElementById('forasChartSubButtons');
        const zwaedSub = document.getElementById('zwaedChartSubButtons');
        const generalTabsContainer = document.getElementById('generalChartTabs');
        const modalTitle = document.getElementById('chartModalTitle');

        pointsSub.style.display = 'none';
        polygonsSub.style.display = 'none';
        forasSub.style.display = 'none';
        zwaedSub.style.display = 'none';
        generalTabsContainer.style.display = 'none';

        if (cat === 'points') {
            pointsSub.style.display = 'flex';
            modalTitle.textContent = 'الرسوم البيانية لعقود الإستثمار';
            renderPointsSubChart('نوع العقد');
        } else if (cat === 'polygons') {
            polygonsSub.style.display = 'flex';
            modalTitle.textContent = 'الرسوم البيانية للأصول والأراضي';
            renderPolygonsSubChart('رقم المخطط');
        } else if (cat === 'foras') {
            forasSub.style.display = 'flex';
            modalTitle.textContent = 'الرسوم البيانية للفرص الإستثمارية';
            renderForasSubChart('حالة الفرصة');
        } else if (cat === 'zwaed') {
            zwaedSub.style.display = 'flex';
            modalTitle.textContent = 'الرسوم البيانية للزوائد';
            renderZwaedSubChart('حالة الاستثمار');
        }
    }

    document.getElementById('closeChartModal').addEventListener('click', () => {
        chartModal.style.display = 'none';
    });

    // لوحة المؤشرات (Dashboard Modal) منطق العرض
    const dashboardModal = document.getElementById('dashboardModal');
    let dashboardChartsInstances = [];

    document.getElementById('openDashboardModalBtn').addEventListener('click', () => {
        dashboardModal.style.display = 'flex';
        renderDashboardCharts();
    });

    document.getElementById('closeDashboardModal').addEventListener('click', () => {
        dashboardModal.style.display = 'none';
    });

    let fullscreenChartInstance = null;

    document.getElementById('closeFullscreenChartModal').addEventListener('click', () => {
        document.getElementById('fullscreenChartModal').style.display = 'none';
        if (fullscreenChartInstance) {
            fullscreenChartInstance.destroy();
            fullscreenChartInstance = null;
        }
    });

    function openFullscreenChart(title, labels, dataCounts, chartType, isLine) {
        const modal = document.getElementById('fullscreenChartModal');
        document.getElementById('fullscreenChartTitle').textContent = title;
        modal.style.display = 'flex';

        const ctx = document.getElementById('fullscreenStatChart').getContext('2d');
        if (fullscreenChartInstance) {
            fullscreenChartInstance.destroy();
        }

        let chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 25 } },
            plugins: {
                legend: { display: chartType === 'doughnut' || isLine, position: 'bottom' },
                datalabels: {
                    anchor: chartType === 'doughnut' ? 'center' : (isLine ? 'bottom' : 'end'),
                    align: chartType === 'doughnut' ? 'center' : (isLine ? 'top' : 'end'),
                    offset: 2,
                    color: chartType === 'doughnut' ? '#fff' : '#023059',
                    font: { weight: 'bold', size: 11, family: 'Cairo' },
                    formatter: function(value) { return value > 0 ? value : ''; }
                }
            }
        };

        if (chartType === 'bar' || isLine) {
            chartOptions.scales = {
                y: { beginAtZero: true, ticks: { precision: 0 }, grace: '10%' }
            };
            if (!isLine) chartOptions.plugins.legend.display = false;
        }

        let datasetConfig = {
            label: title,
            data: dataCounts,
            backgroundColor: ['#023059', '#D6B87E', '#059669', '#dc2626', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#14b8a6', '#ec4899', '#84cc16'],
            borderWidth: 2
        };

        if (isLine) {
            datasetConfig.borderColor = '#023059';
            datasetConfig.backgroundColor = '#023059';
            datasetConfig.fill = false;
            datasetConfig.tension = 0.1;
            datasetConfig.pointRadius = 5;
            datasetConfig.pointBackgroundColor = '#D6B87E';
            chartType = 'line';
        }

        fullscreenChartInstance = new Chart(ctx, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [datasetConfig]
            },
            options: chartOptions,
            plugins: [ChartDataLabels]
        });
    }

    function saveDashboardImage(format) {
        const grid = document.getElementById('dashboardChartsGrid');
        if (!grid) return;
        
        html2canvas(grid, { scale: 2, useCORS: true, scrollY: -window.scrollY }).then(canvas => {
            const link = document.createElement('a');
            if (format === 'jpeg') {
                link.download = 'Dashboard_Export.jpg';
                link.href = canvas.toDataURL('image/jpeg', 1.0);
                link.click();
            } else {
                let url = canvas.toDataURL('image/png');
                let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">`;
                svgContent += `<rect width="100%" height="100%" fill="#ffffff"/>`;
                svgContent += `<foreignObject width="100%" height="100%">`;
                svgContent += `<div xmlns="http://www.w3.org/1999/xhtml"><img src="${url}" width="${canvas.width}" height="${canvas.height}"/></div>`;
                svgContent += `</foreignObject></svg>`;
                const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                link.download = 'Dashboard_Export.svg';
                link.href = URL.createObjectURL(blob);
                link.click();
            }
        });
    }

    function saveFullscreenChartImage(format) {
        const canvas = document.getElementById('fullscreenStatChart');
        if (!canvas) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.fillStyle = '#ffffff';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.drawImage(canvas, 0, 0);

        if (format === 'jpeg') {
            const link = document.createElement('a');
            link.download = 'fullscreen_chart.jpg';
            link.href = tempCanvas.toDataURL('image/jpeg', 1.0);
            link.click();
        } else if (format === 'svg') {
            const url = tempCanvas.toDataURL('image/png');
            let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">`;
            svgContent += `<rect width="100%" height="100%" fill="#ffffff"/>`;
            svgContent += `<foreignObject width="100%" height="100%">`;
            svgContent += `<div xmlns="http://www.w3.org/1999/xhtml"><img src="${url}" width="${canvas.width}" height="${canvas.height}"/></div>`;
            svgContent += `</foreignObject></svg>`;
            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const link = document.createElement('a');
            link.download = 'fullscreen_chart.svg';
            link.href = URL.createObjectURL(blob);
            link.click();
        }
    }

    function renderDashboardCharts() {
        const gridContainer = document.getElementById('dashboardChartsGrid');
        gridContainer.innerHTML = '';

        dashboardChartsInstances.forEach(c => c.destroy());
        dashboardChartsInstances = [];

        const chartConfigs = [
            // عقود الاستثمار
            { type: 'points-sub', title: 'توزيع عقود الاستثمار حسب نوع العقد', field: 'نوع العقد' },
            { type: 'points-sub', title: 'توزيع عقود الاستثمار حسب مصدر العقد', field: 'مصدر العقد', isClusteredBar: true },
            { type: 'points-sub', title: 'توزيع عقود الاستثمار حسب مدة العقد', field: 'مدة العقد' },
            { type: 'points-sub', title: 'توزيع عقود الاستثمار حسب حالة سريان العقد', field: 'حالة سريان العقد', chartKind: 'doughnut' },
            { type: 'points-sub', title: 'توزيع عقود الاستثمار حسب القيمة السنوية للعقد', field: 'القيمة السنوية للعقد' },
            { type: 'points-sub', title: 'توزيع عقود الاستثمار حسب تاريخ بداية العقد', field: 'تاريخ بداية العقد' },
            { type: 'points-sub', title: 'توزيع عقود الاستثمار حسب تاريخ نهاية العقد', field: 'تاريخ نهاية العقد' },
            // الأصول والأراضي
            { type: 'polygons-sub', title: 'توزيع الأصول والأراضي حسب رقم المخطط				', field: 'رقم المخطط', gridSpan: true },
            { type: 'polygons-sub', title: 'توزيع الأصول والأراضي حسب حالة الاستثمار', field: 'حالة الاستثمار' },
            { type: 'polygons-sub', title: 'توزيع الأصول والأراضي حسب البلدية', field: 'البلدية', chartKind: 'doughnut' },
            { type: 'polygons-sub', title: 'توزيع الأصول والأراضي حسب المساحة', field: 'SHAPE_Area' },
            // الفرص الاستثمارية
            { type: 'foras-sub', title: 'توزيع الفرص الاستثمارية حسب حالة الفرصة', field: 'حالة الفرصة' },
            { type: 'foras-sub', title: 'توزيع الفرص الاستثمارية حسب موعد الإعلان', field: 'موعد اعلان الفرصة الاستثمارية' },
            { type: 'foras-sub', title: 'توزيع الفرص الاستثمارية حسب النشاط الرئيسي', field: 'النشاط الرئيسي' },
            { type: 'foras-sub', title: 'توزيع الفرص الاستثمارية حسب النشاط الفرعي', field: 'النشاط الفرعي' },
            { type: 'foras-sub', title: 'توزيع الفرص حسب المستثمرين الذين اشتروا الكراسة', field: 'إجمالي عدد المستثمرين الذين اشتروا الكراسة' },
            { type: 'foras-sub', title: 'توزيع الفرص حسب المستثمرين المتقدمين بالعطاءات', field: 'إجمالي عدد المستثمرين المتقدمين بالعطاءات' },
            // الزوائد
            { type: 'zwaed-sub', title: 'توزيع الزوائد حسب النوع (حالة الاستثمار)', field: 'حالة الاستثمار' },
            { type: 'zwaed-sub', title: 'توزيع الزوائد حسب البلدية', field: 'البلدية' },
            { type: 'zwaed-sub', title: 'توزيع الزوائد حسب المساحة', field: 'SHAPE_Area' }
        ];

        chartConfigs.forEach((cfg, index) => {
            let cardDiv = document.createElement('div');
            let spanStyle = cfg.gridSpan ? "grid-column: span 2;" : "";
            cardDiv.style.cssText = `background: #ffffff; border-radius: 12px; padding: 12px; border: 1px solid #cbd5e1; box-shadow: 0 2px 4px rgba(0,0,0,0.04); display: flex; flex-direction: column; gap: 8px; cursor: pointer; height: 320px; box-sizing: border-box; ${spanStyle}`;
            
            let titleEl = document.createElement('h4');
            titleEl.textContent = cfg.title;
            titleEl.style.cssText = "margin: 0; font-size: 0.9rem; color: #023059; text-align: center; font-weight: 900;";
            cardDiv.appendChild(titleEl);

            let canvasWrap = document.createElement('div');
            canvasWrap.style.cssText = "position: relative; flex-grow: 1; width: 100%;";
            let canvas = document.createElement('canvas');
            canvas.id = `dashChart_${index}`;
            canvasWrap.appendChild(canvas);
            cardDiv.appendChild(canvasWrap);

            gridContainer.appendChild(cardDiv);

            let ctx = canvas.getContext('2d');
            let labels = [];
            let dataCounts = [];

            if (cfg.type === 'points-sub') {
                if (cfg.field === 'القيمة السنوية للعقد') {
                    labels = ['أكثر من 2 مليون', 'مليون : 2 مليون', '750000 : 1000000', '500000 : 750000', '250000 : 500000', '100000 : 250000', '50000 : 100000', '5000 : 50000', 'أقل من 5000'];
                    let countsObj = { 'أكثر من 2 مليون': 0, 'مليون : 2 مليون': 0, '750000 : 1000000': 0, '500000 : 750000': 0, '250000 : 500000': 0, '100000 : 250000': 0, '50000 : 100000': 0, '5000 : 50000': 0, 'أقل من 5000': 0 };
                    allItems.forEach(i => {
                        if (i.geometryType === 'Point' && !i.isForasLayer && !i.isZwaedLayer) {
                            let valStr = i['القيمة السنوية للعقد'] || i['القيمة السنوية للعقد شاملة ضريبة القيمة المضافة'] || '0';
                            let val = parseFloat(valStr.toString().replace(/[^0-9.-]+/g, ""));
                            if (!isNaN(val)) {
                                if (val > 2000000) countsObj['أكثر من 2 مليون']++;
                                else if (val >= 1000000) countsObj['مليون : 2 مليون']++;
                                else if (val >= 750000) countsObj['750000 : 1000000']++;
                                else if (val >= 500000) countsObj['500000 : 750000']++;
                                else if (val >= 250000) countsObj['250000 : 500000']++;
                                else if (val >= 100000) countsObj['100000 : 250000']++;
                                else if (val >= 50000) countsObj['50000 : 100000']++;
                                else if (val >= 5000) countsObj['5000 : 50000']++;
                                else countsObj['أقل من 5000']++;
                            }
                        }
                    });
                    dataCounts = labels.map(l => countsObj[l]);
                } else if (cfg.field === 'تاريخ بداية العقد' || cfg.field === 'تاريخ نهاية العقد') {
                    let yearMap = {};
                    allItems.forEach(i => {
                        if (i.geometryType === 'Point' && !i.isForasLayer && !i.isZwaedLayer) {
                            let dateStr = i[cfg.field];
                            if (dateStr) {
                                let match = dateStr.match(/\b(20\d{2})\b/) || dateStr.match(/\b(\d{4})\b/);
                                let year = match ? match[1] : 'أخرى';
                                yearMap[year] = (yearMap[year] || 0) + 1;
                            } else {
                                yearMap['غير محدد'] = (yearMap['غير محدد'] || 0) + 1;
                            }
                        }
                    });
                    labels = Object.keys(yearMap).sort();
                    dataCounts = labels.map(l => yearMap[l]);
                } else {
                    let mapData = {};
                    allItems.forEach(i => {
                        if (i.geometryType === 'Point' && !i.isForasLayer && !i.isZwaedLayer) {
                            let val = i[cfg.field] || 'غير مصنف';
                            mapData[val] = (mapData[val] || 0) + 1;
                        }
                    });
                    labels = Object.keys(mapData);
                    dataCounts = Object.values(mapData);
                }
            } else if (cfg.type === 'polygons-sub') {
                if (cfg.field === 'SHAPE_Area') {
                    labels = ['أكثر من مليون', '750000 : 1000000', '500000 : 750000', '250000 : 500000', '100000 : 250000', '50000 : 100000', '20000 : 50000', '10000 : 20000', '5000 : 10000', '2000 : 5000', '1000 : 5000', '500 : 1000', 'أقل من 500'];
                    let countsObj = { 'أكثر من مليون': 0, '750000 : 1000000': 0, '500000 : 750000': 0, '250000 : 500000': 0, '100000 : 250000': 0, '50000 : 100000': 0, '20000 : 50000': 0, '10000 : 20000': 0, '5000 : 10000': 0, '2000 : 5000': 0, '1000 : 5000': 0, '500 : 1000': 0, 'أقل من 500': 0 };
                    allItems.forEach(i => {
                        if (i.geometryType === 'Polygon' && !i.isZwaedLayer) {
                            let areaStr = i['SHAPE_Area'] || '0';
                            let val = parseFloat(areaStr.toString().replace(/[^0-9.-]+/g, ""));
                            if (!isNaN(val)) {
                                if (val > 1000000) countsObj['أكثر من مليون']++;
                                else if (val >= 750000) countsObj['750000 : 1000000']++;
                                else if (val >= 500000) countsObj['500000 : 750000']++;
                                else if (val >= 250000) countsObj['250000 : 500000']++;
                                else if (val >= 100000) countsObj['100000 : 250000']++;
                                else if (val >= 50000) countsObj['50000 : 100000']++;
                                else if (val >= 20000) countsObj['20000 : 50000']++;
                                else if (val >= 10000) countsObj['10000 : 20000']++;
                                else if (val >= 5000) countsObj['5000 : 10000']++;
                                else if (val >= 2000) countsObj['2000 : 5000']++;
                                else if (val >= 1000) countsObj['1000 : 5000']++;
                                else if (val >= 500) countsObj['500 : 1000']++;
                                else countsObj['أقل من 500']++;
                            }
                        }
                    });
                    dataCounts = labels.map(l => countsObj[l]);
                } else {
                    let mapData = {};
                    allItems.forEach(i => {
                        if (i.geometryType === 'Polygon' && !i.isZwaedLayer) {
                            let val = i[cfg.field] || 'غير مصنف';
                            mapData[val] = (mapData[val] || 0) + 1;
                        }
                    });
                    labels = Object.keys(mapData);
                    dataCounts = Object.values(mapData);
                }
            } else if (cfg.type === 'foras-sub') {
                if (cfg.field === 'موعد اعلان الفرصة الاستثمارية') {
                    labels = ['2020','2021','2022','2023','2024','2025', '2026'];
                    let countsObj = {'2020': 0,'2021': 0,'2022': 0,'2023': 0,'2024': 0, '2025': 0, '2026': 0, 'أخرى': 0 };
                    allItems.forEach(i => {
                        if (i.isForasLayer) {
                            let dateStr = i[cfg.field] || '';
                            let match = dateStr.match(/\b(2020|2021|2022|2023|2024|2025|2026)\b/);
                            if (match) { countsObj[match[1]]++; } else { countsObj['أخرى']++; }
                        }
                    });
                    labels = ['2020', '2021', '2022', '2023', '2024', '2025', '2026', 'أخرى'];
                    dataCounts = labels.map(l => countsObj[l]);
                } else if (cfg.field === 'إجمالي عدد المستثمرين الذين اشتروا الكراسة' || cfg.field === 'إجمالي عدد المستثمرين المتقدمين بالعطاءات') {
                    labels = ['2020','2021','2022','2023','2024','2025', '2026'];
                    let sumObj = { '2020': 0, '2021': 0, '2022': 0, '2023': 0, '2024': 0, '2025': 0, '2026': 0 };
                    allItems.forEach(i => {
                        if (i.isForasLayer) {
                            let dateStr = i['موعد اعلان الفرصة الاستثمارية'] || '';
                            let match = dateStr.match(/\b(2020|2021|2022|2023|2024|2025|2026)\b/);
                            let year = match ? match[1] : null;
                            if (year && sumObj[year] !== undefined) {
                                let valStr = i[cfg.field] || '0';
                                let val = parseFloat(valStr.toString().replace(/[^0-9.-]+/g, ""));
                                if (!isNaN(val)) { sumObj[year] += val; }
                            }
                        }
                    });
                    dataCounts = labels.map(l => sumObj[l]);
                } else {
                    let mapData = {};
                    allItems.forEach(i => {
                        if (i.isForasLayer) {
                            let val = i[cfg.field] || 'غير مصنف';
                            mapData[val] = (mapData[val] || 0) + 1;
                        }
                    });
                    labels = Object.keys(mapData);
                    dataCounts = Object.values(mapData);
                }
            } else if (cfg.type === 'zwaed-sub') {
                if (cfg.field === 'SHAPE_Area') {
                    labels = ['أكثر من مليون', '750000 : 1000000', '500000 : 750000', '250000 : 500000', '100000 : 250000', '50000 : 100000', '20000 : 50000', '10000 : 20000', '5000 : 10000', '2000 : 5000', '1000 : 5000', '500 : 1000', 'أقل من 500'];
                    let countsObj = { 'أكثر من مليون': 0, '750000 : 1000000': 0, '500000 : 750000': 0, '250000 : 500000': 0, '100000 : 250000': 0, '50000 : 100000': 0, '20000 : 50000': 0, '10000 : 20000': 0, '5000 : 10000': 0, '2000 : 5000': 0, '1000 : 5000': 0, '500 : 1000': 0, 'أقل من 500': 0 };
                    allItems.forEach(i => {
                        if (i.isZwaedLayer) {
                            let areaStr = i['SHAPE_Area'] || '0';
                            let val = parseFloat(areaStr.toString().replace(/[^0-9.-]+/g, ""));
                            if (!isNaN(val)) {
                                if (val > 1000000) countsObj['أكثر من مليون']++;
                                else if (val >= 750000) countsObj['750000 : 1000000']++;
                                else if (val >= 500000) countsObj['500000 : 750000']++;
                                else if (val >= 250000) countsObj['250000 : 500000']++;
                                else if (val >= 100000) countsObj['100000 : 250000']++;
                                else if (val >= 50000) countsObj['50000 : 100000']++;
                                else if (val >= 20000) countsObj['20000 : 50000']++;
                                else if (val >= 10000) countsObj['10000 : 20000']++;
                                else if (val >= 5000) countsObj['5000 : 10000']++;
                                else if (val >= 2000) countsObj['2000 : 5000']++;
                                else if (val >= 1000) countsObj['1000 : 5000']++;
                                else if (val >= 500) countsObj['500 : 1000']++;
                                else countsObj['أقل من 500']++;
                            }
                        }
                    });
                    dataCounts = labels.map(l => countsObj[l]);
                } else {
                    let mapData = {};
                    allItems.forEach(i => {
                        if (i.isZwaedLayer) {
                            let val = i[cfg.field] || 'غير مصنف';
                            mapData[val] = (mapData[val] || 0) + 1;
                        }
                    });
                    labels = Object.keys(mapData);
                    dataCounts = Object.values(mapData);
                }
            }

            let chartType = cfg.chartKind === 'doughnut' ? 'doughnut' : 'bar';
            let chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 20 } },
                plugins: {
                    legend: { display: chartType === 'doughnut' || cfg.isClusteredBar, position: 'bottom' },
                    datalabels: {
                        anchor: chartType === 'doughnut' ? 'center' : 'end',
                        align: chartType === 'doughnut' ? 'center' : 'end',
                        offset: 2,
                        color: chartType === 'doughnut' ? '#fff' : '#023059',
                        font: { weight: 'bold', size: 10, family: 'Cairo' },
                        formatter: function(value) { return value > 0 ? value : ''; }
                    }
                }
            };

            let datasets = [];
            if (cfg.isClusteredBar) {
                datasets = labels.map((lbl, idx) => {
                    let palette = ['#023059', '#D6B87E', '#059669', '#dc2626', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#14b8a6', '#ec4899', '#84cc16'];
                    let arr = new Array(labels.length).fill(0);
                    arr[idx] = dataCounts[idx];
                    return {
                        label: lbl,
                        data: arr,
                        backgroundColor: palette[idx % palette.length],
                        borderWidth: 1
                    };
                });
            } else {
                datasets = [{
                    label: cfg.title,
                    data: dataCounts,
                    backgroundColor: ['#023059', '#D6B87E', '#059669', '#dc2626', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#14b8a6', '#ec4899', '#84cc16'],
                    borderWidth: 1
                }];
            }

            if (chartType === 'bar') {
                chartOptions.scales = {
                    y: { beginAtZero: true, ticks: { precision: 0 }, grace: '10%' },
                    x: { stacked: false }
                };
                if (!cfg.isClusteredBar) chartOptions.plugins.legend.display = false;
            }

            let newChart = new Chart(ctx, {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: datasets
                },
                options: chartOptions,
                plugins: [ChartDataLabels]
            });

            cardDiv.addEventListener('click', () => {
                openFullscreenChart(cfg.title, labels, dataCounts, chartType, false);
            });

            dashboardChartsInstances.push(newChart);
        });
    }

    function switchChartType(type) {
        currentChartType = type;
        document.querySelectorAll('#generalChartTabs .tab-btn').forEach(b => b.classList.remove('active'));
        if (type === 'points') document.getElementById('chartTabPoints').classList.add('active');
        else if (type === 'polygons') document.getElementById('chartTabPolygons').classList.add('active');
        else if (type === 'foras') document.getElementById('chartTabForas').classList.add('active');
        else if (type === 'zwaed') document.getElementById('chartTabZwaed').classList.add('active');

        renderStatChart(type);
    }

    function saveChartImage(format) {
        const canvas = document.getElementById('statChart');
        if (!canvas) return;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tCtx = tempCanvas.getContext('2d');
        
        tCtx.fillStyle = '#ffffff';
        tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        tCtx.drawImage(canvas, 0, 0);

        if (format === 'jpeg') {
            const link = document.createElement('a');
            link.download = 'chart_export.jpg';
            link.href = tempCanvas.toDataURL('image/jpeg', 1.0);
            link.click();
        } else if (format === 'svg') {
            const url = tempCanvas.toDataURL('image/png');
            let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">`;
            svgContent += `<rect width="100%" height="100%" fill="#ffffff"/>`;
            svgContent += `<foreignObject width="100%" height="100%">`;
            svgContent += `<div xmlns="http://www.w3.org/1999/xhtml"><img src="${url}" width="${canvas.width}" height="${canvas.height}"/></div>`;
            svgContent += `</foreignObject></svg>`;
            
            const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
            const link = document.createElement('a');
            link.download = 'chart_export.svg';
            link.href = URL.createObjectURL(blob);
            link.click();
        }
    }

    function renderPointsSubChart(fieldTitle) {
        currentPointsSubField = fieldTitle;
        const subButtons = document.querySelectorAll('#pointsChartSubButtons .tab-btn');
        subButtons.forEach(btn => {
            if (btn.textContent.includes(fieldTitle)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const ctx = document.getElementById('statChart').getContext('2d');
        if (myChart) {
            myChart.destroy();
        }

        let labels = [];
        let dataCounts = [];
        let chartLabelText = `توزيع عقود الاستثمار حسب ${fieldTitle}`;
        let isClustered = (fieldTitle === 'مصدر العقد');

        if (fieldTitle === 'القيمة السنوية للعقد') {
            labels = [
                'أكثر من 2 مليون',
                'مليون : 2 مليون',
                '750000 : 1000000',
                '500000 : 750000',
                '250000 : 500000',
                '100000 : 250000',
                '50000 : 100000',
                '5000 : 50000',
                'أقل من 5000'
            ];
            let countsObj = {
                'أكثر من 2 مليون': 0,
                'مليون : 2 مليون': 0,
                '750000 : 1000000': 0,
                '500000 : 750000': 0,
                '250000 : 500000': 0,
                '100000 : 250000': 0,
                '50000 : 100000': 0,
                '5000 : 50000': 0,
                'أقل من 5000': 0
            };

            allItems.forEach(i => {
                if (i.geometryType === 'Point' && !i.isForasLayer && !i.isZwaedLayer) {
                    let valStr = i['القيمة السنوية للعقد'] || i['القيمة السنوية للعقد شاملة ضريبة القيمة المضافة'] || '0';
                    let val = parseFloat(valStr.toString().replace(/[^0-9.-]+/g, ""));
                    if (!isNaN(val)) {
                        if (val > 2000000) countsObj['أكثر من 2 مليون']++;
                        else if (val >= 1000000) countsObj['مليون : 2 مليون']++;
                        else if (val >= 750000) countsObj['750000 : 1000000']++;
                        else if (val >= 500000) countsObj['500000 : 750000']++;
                        else if (val >= 250000) countsObj['250000 : 500000']++;
                        else if (val >= 100000) countsObj['100000 : 250000']++;
                        else if (val >= 50000) countsObj['50000 : 100000']++;
                        else if (val >= 5000) countsObj['5000 : 50000']++;
                        else countsObj['أقل من 5000']++;
                    }
                }
            });
            dataCounts = labels.map(l => countsObj[l]);

        } else if (fieldTitle === 'تاريخ بداية العقد' || fieldTitle === 'تاريخ نهاية العقد') {
            let yearMap = {};
            allItems.forEach(i => {
                if (i.geometryType === 'Point' && !i.isForasLayer && !i.isZwaedLayer) {
                    let dateStr = i[fieldTitle];
                    if (dateStr) {
                        let match = dateStr.match(/\b(20\d{2})\b/) || dateStr.match(/\b(\d{4})\b/);
                        let year = match ? match[1] : 'أخرى';
                        yearMap[year] = (yearMap[year] || 0) + 1;
                    } else {
                        yearMap['غير محدد'] = (yearMap['غير محدد'] || 0) + 1;
                    }
                }
            });
            labels = Object.keys(yearMap).sort();
            dataCounts = labels.map(l => yearMap[l]);

        } else {
            let mapData = {};
            allItems.forEach(i => {
                if (i.geometryType === 'Point' && !i.isForasLayer && !i.isZwaedLayer) {
                    let val = i[fieldTitle] || 'غير مصنف';
                    mapData[val] = (mapData[val] || 0) + 1;
                }
            });
            labels = Object.keys(mapData);
            dataCounts = Object.values(mapData);
        }

        let datasets = [];
        if (isClustered) {
            datasets = labels.map((lbl, idx) => {
                let palette = ['#023059', '#D6B87E', '#059669', '#dc2626', '#8b5cf6', '#3b82f6', '#10b981'];
                let arr = new Array(labels.length).fill(0);
                arr[idx] = dataCounts[idx];
                return {
                    label: lbl,
                    data: arr,
                    backgroundColor: palette[idx % palette.length],
                    borderWidth: 1
                };
            });
        } else {
            datasets = [{
                label: chartLabelText,
                data: dataCounts,
                backgroundColor: ['#023059', '#D6B87E', '#059669', '#dc2626', '#8b5cf6', '#3b82f6', '#10b981'],
                borderWidth: 1
            }];
        }

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 25 }
                },
                plugins: {
                    legend: { display: isClustered },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        offset: 2,
                        color: '#023059',
                        font: { weight: 'bold', size: 11, family: 'Cairo' },
                        formatter: function(value) {
                            return value > 0 ? value : '';
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { precision: 0 },
                        grace: '10%' 
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    function renderPolygonsSubChart(fieldTitle) {
        const subButtons = document.querySelectorAll('#polygonsChartSubButtons .tab-btn');
        subButtons.forEach(btn => {
            if (btn.getAttribute('onclick').includes(fieldTitle)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const ctx = document.getElementById('statChart').getContext('2d');
        if (myChart) {
            myChart.destroy();
        }

        let labels = [];
        let dataCounts = [];
        let chartLabelText = `توزيع الأصول والأراضي حسب ${fieldTitle}`;

        if (fieldTitle === 'SHAPE_Area') {
            labels = [
                'أكثر من مليون',
                '750000 : 1000000',
                '500000 : 750000',
                '250000 : 500000',
                '100000 : 250000',
                '50000 : 100000',
                '20000 : 50000',
                '10000 : 20000',
                '5000 : 10000',
                '2000 : 5000',
                '1000 : 5000',
                '500 : 1000',
                'أقل من 500'
            ];
            let countsObj = {
                'أكثر من مليون': 0,
                '750000 : 1000000': 0,
                '500000 : 750000': 0,
                '250000 : 500000': 0,
                '100000 : 250000': 0,
                '50000 : 100000': 0,
                '20000 : 50000': 0,
                '10000 : 20000': 0,
                '5000 : 10000': 0,
                '2000 : 5000': 0,
                '1000 : 5000': 0,
                '500 : 1000': 0,
                'أقل من 500': 0
            };

            allItems.forEach(i => {
                if (i.geometryType === 'Polygon' && !i.isZwaedLayer) {
                    let areaStr = i['SHAPE_Area'] || '0';
                    let val = parseFloat(areaStr.toString().replace(/[^0-9.-]+/g, ""));
                    if (!isNaN(val)) {
                        if (val > 1000000) countsObj['أكثر من مليون']++;
                        else if (val >= 750000) countsObj['750000 : 1000000']++;
                        else if (val >= 500000) countsObj['500000 : 750000']++;
                        else if (val >= 250000) countsObj['250000 : 500000']++;
                        else if (val >= 100000) countsObj['100000 : 250000']++;
                        else if (val >= 50000) countsObj['50000 : 100000']++;
                        else if (val >= 20000) countsObj['20000 : 50000']++;
                        else if (val >= 10000) countsObj['10000 : 20000']++;
                        else if (val >= 5000) countsObj['5000 : 10000']++;
                        else if (val >= 2000) countsObj['2000 : 5000']++;
                        else if (val >= 1000) countsObj['1000 : 5000']++;
                        else if (val >= 500) countsObj['500 : 1000']++;
                        else countsObj['أقل من 500']++;
                    }
                }
            });
            dataCounts = labels.map(l => countsObj[l]);
        } else {
            let mapData = {};
            allItems.forEach(i => {
                if (i.geometryType === 'Polygon' && !i.isZwaedLayer) {
                    let val = i[fieldTitle] || 'غير مصنف';
                    mapData[val] = (mapData[val] || 0) + 1;
                }
            });
            labels = Object.keys(mapData);
            dataCounts = Object.values(mapData);
        }

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: chartLabelText,
                    data: dataCounts,
                    backgroundColor: ['#023059', '#D6B87E', '#059669', '#dc2626', '#8b5cf6', '#3b82f6', '#10b981'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 25 } },
                plugins: {
                    legend: { display: true },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        offset: 2,
                        color: '#023059',
                        font: { weight: 'bold', size: 11, family: 'Cairo' },
                        formatter: function(value) { return value > 0 ? value : ''; }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 }, grace: '10%' }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    function renderForasSubChart(fieldTitle) {
        const subButtons = document.querySelectorAll('#forasChartSubButtons .tab-btn');
        subButtons.forEach(btn => {
            if (btn.getAttribute('onclick').includes(fieldTitle)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const ctx = document.getElementById('statChart').getContext('2d');
        if (myChart) {
            myChart.destroy();
        }

        let labels = [];
        let dataCounts = [];
        let chartLabelText = `توزيع الفرص الاستثمارية حسب ${fieldTitle}`;

        if (fieldTitle === 'موعد اعلان الفرصة الاستثمارية') {
            labels = ['2020','2021','2022','2023','2024','2025', '2026'];
            let countsObj = {'2020': 0,'2021': 0,'2022': 0,'2023': 0,'2024': 0, '2025': 0, '2026': 0, 'أخرى': 0 };

            allItems.forEach(i => {
                if (i.isForasLayer) {
                    let dateStr = i[fieldTitle] || '';
                    let match = dateStr.match(/\b(2020|2021|2022|2023|2024|2025|2026)\b/);
                    if (match) {
                        countsObj[match[1]]++;
                    } else {
                        countsObj['أخرى']++;
                    }
                }
            });
            labels = ['2020', '2021', '2022', '2023', '2024', '2025', '2026', 'أخرى'];
            dataCounts = labels.map(l => countsObj[l]);

        } else if (fieldTitle === 'إجمالي عدد المستثمرين الذين اشتروا الكراسة' || fieldTitle === 'إجمالي عدد المستثمرين المتقدمين بالعطاءات') {
            labels = ['2020','2021','2022','2023','2024','2025', '2026'];
            let sumObj = { '2020': 0, '2021': 0, '2022': 0, '2023': 0, '2024': 0, '2025': 0, '2026': 0 };

            allItems.forEach(i => {
                if (i.isForasLayer) {
                    let dateStr = i['موعد اعلان الفرصة الاستثمارية'] || '';
                    let match = dateStr.match(/\b(2020|2021|2022|2023|2024|2025|2026)\b/);
                    let year = match ? match[1] : null;
                    if (year && sumObj[year] !== undefined) {
                        let valStr = i[fieldTitle] || '0';
                        let val = parseFloat(valStr.toString().replace(/[^0-9.-]+/g, ""));
                        if (!isNaN(val)) {
                            sumObj[year] += val;
                        }
                    }
                }
            });
            dataCounts = labels.map(l => sumObj[l]);

        } else {
            let mapData = {};
            allItems.forEach(i => {
                if (i.isForasLayer) {
                    let val = i[fieldTitle] || 'غير مصنف';
                    mapData[val] = (mapData[val] || 0) + 1;
                }
            });
            labels = Object.keys(mapData);
            dataCounts = Object.values(mapData);
        }

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: chartLabelText,
                    data: dataCounts,
                    backgroundColor: ['#023059', '#D6B87E', '#059669', '#dc2626', '#8b5cf6', '#3b82f6', '#10b981'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 25 } },
                plugins: {
                    legend: { display: true },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        offset: 2,
                        color: '#023059',
                        font: { weight: 'bold', size: 11, family: 'Cairo' },
                        formatter: function(value) { return value > 0 ? value : ''; }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 }, grace: '10%' }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    function renderZwaedSubChart(fieldTitle) {
        const subButtons = document.querySelectorAll('#zwaedChartSubButtons .tab-btn');
        subButtons.forEach(btn => {
            if (btn.getAttribute('onclick').includes(fieldTitle)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        const ctx = document.getElementById('statChart').getContext('2d');
        if (myChart) {
            myChart.destroy();
        }

        let labels = [];
        let dataCounts = [];
        let chartLabelText = `توزيع الزوائد حسب ${fieldTitle}`;

        if (fieldTitle === 'SHAPE_Area') {
            labels = [
                'أكثر من مليون',
                '750000 : 1000000',
                '500000 : 750000',
                '250000 : 500000',
                '100000 : 250000',
                '50000 : 100000',
                '20000 : 50000',
                '10000 : 20000',
                '5000 : 10000',
                '2000 : 5000',
                '1000 : 5000',
                '500 : 1000',
                'أقل من 500'
            ];
            let countsObj = {
                'أكثر من مليون': 0,
                '750000 : 1000000': 0,
                '500000 : 750000': 0,
                '250000 : 500000': 0,
                '100000 : 250000': 0,
                '50000 : 100000': 0,
                '20000 : 50000': 0,
                '10000 : 20000': 0,
                '5000 : 10000': 0,
                '2000 : 5000': 0,
                '1000 : 5000': 0,
                '500 : 1000': 0,
                'أقل من 500': 0
            };

            allItems.forEach(i => {
                if (i.isZwaedLayer) {
                    let areaStr = i['SHAPE_Area'] || '0';
                    let val = parseFloat(areaStr.toString().replace(/[^0-9.-]+/g, ""));
                    if (!isNaN(val)) {
                        if (val > 1000000) countsObj['أكثر من مليون']++;
                        else if (val >= 750000) countsObj['750000 : 1000000']++;
                        else if (val >= 500000) countsObj['500000 : 750000']++;
                        else if (val >= 250000) countsObj['250000 : 500000']++;
                        else if (val >= 100000) countsObj['100000 : 250000']++;
                        else if (val >= 50000) countsObj['50000 : 100000']++;
                        else if (val >= 20000) countsObj['20000 : 50000']++;
                        else if (val >= 10000) countsObj['10000 : 20000']++;
                        else if (val >= 5000) countsObj['5000 : 10000']++;
                        else if (val >= 2000) countsObj['2000 : 5000']++;
                        else if (val >= 1000) countsObj['1000 : 5000']++;
                        else if (val >= 500) countsObj['500 : 1000']++;
                        else countsObj['أقل من 500']++;
                    }
                }
            });
            dataCounts = labels.map(l => countsObj[l]);
        } else {
            let mapData = {};
            allItems.forEach(i => {
                if (i.isZwaedLayer) {
                    let val = i[fieldTitle] || 'غير مصنف';
                    mapData[val] = (mapData[val] || 0) + 1;
                }
            });
            labels = Object.keys(mapData);
            dataCounts = Object.values(mapData);
        }

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: chartLabelText,
                    data: dataCounts,
                    backgroundColor: ['#8b5cf6', '#D6B87E', '#059669', '#dc2626', '#023059', '#3b82f6', '#10b981'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 25 } },
                plugins: {
                    legend: { display: true },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        offset: 2,
                        color: '#023059',
                        font: { weight: 'bold', size: 11, family: 'Cairo' },
                        formatter: function(value) { return value > 0 ? value : ''; }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 }, grace: '10%' }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    function renderStatChart(type) {
        const ctx = document.getElementById('statChart').getContext('2d');
        if (myChart) {
            myChart.destroy();
        }

        let labels = [];
        let dataCounts = [];
        let chartLabelText = '';

        if (type === 'points') {
            chartLabelText = 'توزيع عقود الاستثمار حسب نوع العقد';
            let typeMap = {};
            allItems.forEach(i => {
                if (i.geometryType === 'Point' && !i.isForasLayer && !i.isZwaedLayer) {
                    let t = i['نوع العقد'] || 'غير مصنف';
                    typeMap[t] = (typeMap[t] || 0) + 1;
                }
            });
            labels = Object.keys(typeMap);
            dataCounts = Object.values(typeMap);
        } else if (type === 'polygons') {
            chartLabelText = 'توزيع الأصول والأراضي حسب حالة الاستثمار';
            let statusMap = {};
            allItems.forEach(i => {
                if (i.geometryType === 'Polygon' && !i.isZwaedLayer) {
                    let st = i['حالة الاستثمار'] || 'غير مصنف';
                    statusMap[st] = (statusMap[st] || 0) + 1;
                }
            });
            labels = Object.keys(statusMap);
            dataCounts = Object.values(statusMap);
        } else if (type === 'foras') {
            chartLabelText = 'توزيع الفرص الاستثمارية حسب النشاط الرئيسي';
            let activityMap = {};
            allItems.forEach(i => {
                if (i.isForasLayer) {
                    let act = i['النشاط الرئيسي'] || 'غير مصنف';
                    activityMap[act] = (activityMap[act] || 0) + 1;
                }
            });
            labels = Object.keys(activityMap);
            dataCounts = Object.values(activityMap);
        } else if (type === 'zwaed') {
            chartLabelText = 'توزيع الزوائد حسب حالة الاستثمار';
            let zwaedMap = {};
            allItems.forEach(i => {
                if (i.isZwaedLayer) {
                    let zSt = i['حالة الاستثمار'] || 'غير مصنف';
                    zwaedMap[zSt] = (zwaedMap[zSt] || 0) + 1;
                }
            });
            labels = Object.keys(zwaedMap);
            dataCounts = Object.values(zwaedMap);
        }

        myChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: chartLabelText,
                    data: dataCounts,
                    backgroundColor: ['#023059', '#D6B87E', '#059669', '#dc2626', '#8b5cf6', '#3b82f6', '#10b981'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: { top: 25 }
                },
                plugins: {
                    legend: { display: true },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        offset: 2,
                        color: '#023059',
                        font: { weight: 'bold', size: 11, family: 'Cairo' },
                        formatter: function(value) {
                            return value > 0 ? value : '';
                        }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true, 
                        ticks: { precision: 0 },
                        grace: '10%' 
                    }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    // Dropdown map export
    const exportMapDropdown = document.getElementById('exportMapDropdown');
    document.getElementById('exportMapToggleBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        exportMapDropdown.classList.toggle('active');
    });
    window.addEventListener('click', () => {
        exportMapDropdown.classList.remove('active');
    });

    function exportMapQuality(quality) {
        exportMapDropdown.classList.remove('active');
        alert('جاري تصدير الخريطة بجودة ' + quality + '...');
        const mapElement = document.getElementById('mapContainerWrapper');
        html2canvas(mapElement, { scale: quality === '4k' ? 2 : (quality === '8k' ? 3 : 1), useCORS: true }).then(canvas => {
            let link = document.createElement('a');
            link.download = `Investment_Map_${quality}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }

    // Export Excel
    document.getElementById('exportExcelBtn').addEventListener('click', () => {
        if (currentFilteredItems.length === 0) {
            alert('لا توجد بيانات للتصدير!');
            return;
        }
        let exportData = currentFilteredItems.map(item => {
            let clean = { ...item };
            delete clean.polygonCoords;
            delete clean.geometryType;
            delete clean.id;
            return clean;
        });
        let worksheet = XLSX.utils.json_to_sheet(exportData);
        let workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "النتائج");
        XLSX.writeFile(workbook, "Investment_Data_Export.xlsx");
    });

    // Export PDF (Filtered / Selected items only)
    document.getElementById('exportPdfBtn').addEventListener('click', () => {
        if (currentFilteredItems.length === 0) {
            alert('لا توجد بيانات للتصدير!');
            return;
        }
        let printWindow = window.open('', '_blank');
        let title = currentActiveTab === 'tabPoints' ? 'تقرير عقود الاستثمار المفلترة' : (currentActiveTab === 'tabPolygons' ? 'تقرير الأصول والأراضي المفلترة' : (currentActiveTab === 'tabForas' ? 'تقرير الفرص الاستثمارية المفلترة' : 'تقرير الزوائد المفلترة'));
        
        let html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>${title}</title><style>body{font-family:'Cairo',sans-serif;padding:20px;color:#023059;}table{width:100%;border-collapse:collapse;margin-top:15px;font-size:12px;}th,td{border:1px solid #cbd5e1;padding:8px;text-align:right;}th{background:#D6B87E;color:#023059;}h2{text-align:center;color:#023059;}</style></head><body>`;
        html += `<h2>وكالة التخصيص والإستدامة المالية - ${title}</h2>`;
        html += `<p>عدد العناصر المفلترة: ${currentFilteredItems.length}</p>`;
        html += `<table><thead><tr>`;
        
        let fields = currentActiveTab === 'tabPoints' ? pointFields : (currentActiveTab === 'tabPolygons' ? polygonFields : (currentActiveTab === 'tabForas' ? forasFields : zwaedFields));
        fields.forEach(f => { html += `<th>${f}</th>`; });
        html += `</tr></thead><tbody>`;
        
        currentFilteredItems.forEach(item => {
            html += `<tr>`;
            fields.forEach(f => {
                html += `<td>${item[f] !== undefined && item[f] !== '' ? item[f] : '-'}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table></body></html>`;
        
        printWindow.document.write(html);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
    });
