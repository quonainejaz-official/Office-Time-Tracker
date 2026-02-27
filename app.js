// Office Time Calculator - Main Application Logic
class OfficeTimeCalculator {
    constructor() {
        this.SCHEMA_VERSION = 3;

        this.STORAGE_KEYS = {
            schemaVersion: 'otc_schema_version',
            currentState: 'otc_current_state',
            todayData: 'otc_today_data',
            settings: 'otc_settings',
            theme: 'otc_theme'
        };

        this.STATES = {
            NOT_STARTED: 'not_started',
            CHECKED_IN: 'checked_in',
            ON_BREAK: 'on_break',
            COMPLETED: 'completed'
        };

        this.DEFAULT_TARGETS = {
            normal: 8 * 60 * 60 * 1000,
            ramadan: 7.5 * 60 * 60 * 1000
        };

        this.state = this.STATES.NOT_STARTED;
        this.todayData = null;
        this.settings = {
            ramadanMode: false
        };
        this.activeScreen = 'main';
        this.dialogResolver = null;
        this.updateInterval = null;
        this.elements = {};

        this.init();
    }

    init() {
        this.loadStoredData();
        this.initializeElements();
        this.bindEvents();
        this.applyTheme();
        this.checkDailyReset();
        this.updateUI();
        this.startUpdateTimer();
        this.registerServiceWorker();
    }

    loadStoredData() {
        let storedSchemaVersion = 1;

        try {
            const schemaValue = Number(localStorage.getItem(this.STORAGE_KEYS.schemaVersion));
            if (Number.isFinite(schemaValue) && schemaValue > 0) {
                storedSchemaVersion = schemaValue;
            }

            const storedState = localStorage.getItem(this.STORAGE_KEYS.currentState);
            if (Object.values(this.STATES).includes(storedState)) {
                this.state = storedState;
            }

            const storedTodayData = this.safeParse(localStorage.getItem(this.STORAGE_KEYS.todayData), null);
            this.todayData = this.normalizeTodayData(storedTodayData) || this.createEmptyTodayData();

            const storedSettings = this.safeParse(localStorage.getItem(this.STORAGE_KEYS.settings), {});
            if (storedSettings && typeof storedSettings === 'object') {
                this.settings = {
                    ramadanMode: Boolean(storedSettings.ramadanMode)
                };
            }
        } catch (error) {
            console.error('Error loading stored data:', error);
            this.state = this.STATES.NOT_STARTED;
            this.todayData = this.createEmptyTodayData();
        }

        this.runMigration(storedSchemaVersion);
        this.reconcileStateFromTodayData();
    }

    runMigration(storedSchemaVersion) {
        this.todayData = this.normalizeTodayData(this.todayData) || this.createEmptyTodayData();

        if (!Object.values(this.STATES).includes(this.state)) {
            this.state = this.STATES.NOT_STARTED;
        }

        if (storedSchemaVersion < this.SCHEMA_VERSION) {
            localStorage.removeItem('otc_history');
            localStorage.setItem(this.STORAGE_KEYS.schemaVersion, String(this.SCHEMA_VERSION));
            this.saveData();
        }
    }

    saveData() {
        try {
            localStorage.setItem(this.STORAGE_KEYS.schemaVersion, String(this.SCHEMA_VERSION));
            localStorage.setItem(this.STORAGE_KEYS.currentState, this.state);
            localStorage.setItem(this.STORAGE_KEYS.todayData, JSON.stringify(this.todayData));
            localStorage.setItem(this.STORAGE_KEYS.settings, JSON.stringify(this.settings));
        } catch (error) {
            console.error('Error saving data:', error);
        }
    }

    initializeElements() {
        this.elements = {
            checkinBtn: document.getElementById('checkin-btn'),
            breakStartBtn: document.getElementById('break-start-btn'),
            breakStopBtn: document.getElementById('break-stop-btn'),
            checkoutBtn: document.getElementById('checkout-btn'),
            themeToggle: document.getElementById('theme-toggle'),
            settingsBtn: document.getElementById('settings-btn'),
            mainScreen: document.getElementById('main-screen'),
            breaksScreen: document.getElementById('breaks-screen'),
            openBreaksScreen: document.getElementById('open-breaks-screen'),
            backMainScreen: document.getElementById('back-main-screen'),

            remainingTime: document.getElementById('remaining-time'),
            workedTime: document.getElementById('worked-time'),
            currentStatuses: document.querySelectorAll('.status-field-current'),
            dailyTargets: document.querySelectorAll('.status-field-target'),
            estimatedCheckouts: document.querySelectorAll('.status-field-estimated'),
            breakCheckinTime: document.getElementById('break-checkin-time'),
            breakCurrentStart: document.getElementById('break-current-start'),
            breakTotalCount: document.getElementById('break-total-count'),
            breakTotalTime: document.getElementById('break-total-time'),
            breakEstCheckout: document.getElementById('break-est-checkout'),
            breakHistoryList: document.getElementById('break-history-list'),
            breakHistoryEmpty: document.getElementById('break-history-empty'),

            progressRing: document.querySelector('.progress-ring-fill'),

            settingsModal: document.getElementById('settings-modal'),
            ramadanMode: document.getElementById('ramadan-mode'),
            closeSettings: document.getElementById('close-settings'),

            editTimes: document.getElementById('edit-times'),
            timeEditModal: document.getElementById('time-edit-modal'),
            closeTimeEdit: document.getElementById('close-time-edit'),
            editCheckinTime: document.getElementById('edit-checkin-time'),
            editCheckoutTime: document.getElementById('edit-checkout-time'),
            breaksList: document.getElementById('breaks-list'),
            addBreakRow: document.getElementById('add-break-row'),
            clearBreaks: document.getElementById('clear-breaks'),
            clearCheckin: document.getElementById('clear-checkin'),
            clearCheckout: document.getElementById('clear-checkout'),
            saveTimeEdits: document.getElementById('save-time-edits'),
            cancelTimeEdits: document.getElementById('cancel-time-edits'),

            dialogModal: document.getElementById('dialog-modal'),
            dialogTitle: document.getElementById('dialog-title'),
            dialogMessage: document.getElementById('dialog-message'),
            dialogClose: document.getElementById('dialog-close'),
            dialogCancel: document.getElementById('dialog-cancel'),
            dialogConfirm: document.getElementById('dialog-confirm')
        };
    }

    bindEvents() {
        this.elements.checkinBtn.addEventListener('click', () => this.checkIn());
        this.elements.breakStartBtn.addEventListener('click', () => this.startBreak());
        this.elements.breakStopBtn.addEventListener('click', () => this.stopBreak());
        this.elements.checkoutBtn.addEventListener('click', () => this.checkOut());

        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
        this.elements.openBreaksScreen.addEventListener('click', () => this.switchScreen('breaks'));
        this.elements.backMainScreen.addEventListener('click', () => this.switchScreen('main'));

        this.elements.editTimes.addEventListener('click', () => this.openTimeEdit());
        this.elements.closeTimeEdit.addEventListener('click', () => this.closeTimeEdit());
        this.elements.saveTimeEdits.addEventListener('click', () => this.saveTimeEdits());
        this.elements.cancelTimeEdits.addEventListener('click', () => this.closeTimeEdit());
        this.elements.dialogClose.addEventListener('click', () => this.closeDialog(false));
        this.elements.dialogCancel.addEventListener('click', () => this.closeDialog(false));
        this.elements.dialogConfirm.addEventListener('click', () => this.closeDialog(true));

        this.elements.addBreakRow.addEventListener('click', () => this.appendBreakRow());
        this.elements.clearBreaks.addEventListener('click', () => {
            this.elements.breaksList.innerHTML = '';
            this.appendBreakRow();
        });
        this.elements.breaksList.addEventListener('click', (e) => {
            const removeBtn = e.target.closest('.remove-break-btn');
            if (!removeBtn) {
                return;
            }

            const row = removeBtn.closest('.break-row');
            if (row) {
                row.remove();
            }

            if (this.elements.breaksList.children.length === 0) {
                this.appendBreakRow();
            }
        });

        this.elements.clearCheckin.addEventListener('click', () => {
            this.elements.editCheckinTime.value = '';
        });
        this.elements.clearCheckout.addEventListener('click', () => {
            this.elements.editCheckoutTime.value = '';
        });

        this.elements.ramadanMode.addEventListener('change', (e) => {
            this.settings.ramadanMode = e.target.checked;
            this.saveData();
            this.updateUI();
        });

        this.elements.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.elements.settingsModal) {
                this.closeSettings();
            }
        });

        this.elements.timeEditModal.addEventListener('click', (e) => {
            if (e.target === this.elements.timeEditModal) {
                this.closeTimeEdit();
            }
        });

        this.elements.dialogModal.addEventListener('click', (e) => {
            if (e.target === this.elements.dialogModal) {
                this.closeDialog(false);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettings();
                this.closeTimeEdit();
                this.closeDialog(false);
            }
        });
    }

    checkIn() {
        if (this.state !== this.STATES.NOT_STARTED || this.todayData.checkInTime) {
            return;
        }

        this.todayData.checkInTime = Date.now();
        this.todayData.checkOutTime = null;
        this.todayData.breakStartTime = null;
        this.todayData.breaks = [];
        this.todayData.totalBreakTime = 0;
        this.todayData.workedTime = 0;
        this.state = this.STATES.CHECKED_IN;

        this.saveData();
        this.updateUI();
    }

    startBreak() {
        if (this.state !== this.STATES.CHECKED_IN || !this.todayData.checkInTime || this.todayData.breakStartTime) {
            return;
        }

        this.todayData.breakStartTime = Date.now();
        this.state = this.STATES.ON_BREAK;

        this.saveData();
        this.updateUI();
    }

    stopBreak() {
        if (this.state !== this.STATES.ON_BREAK || !this.todayData.breakStartTime) {
            return;
        }

        const breakEnd = Date.now();
        const breakStart = this.todayData.breakStartTime;

        this.todayData.breaks.push({ start: breakStart, end: breakEnd });
        this.todayData.breakStartTime = null;
        this.todayData.totalBreakTime = this.calculateCompletedBreakTime(this.todayData);
        this.state = this.STATES.CHECKED_IN;

        this.saveData();
        this.updateUI();
    }

    async checkOut() {
        if (![this.STATES.CHECKED_IN, this.STATES.ON_BREAK].includes(this.state) || !this.todayData.checkInTime) {
            return;
        }

        const confirmed = await this.showConfirm(
            "Are you sure you want to check out? This will complete today's session.",
            'Confirm Check Out'
        );
        if (!confirmed) {
            return;
        }

        const now = Date.now();

        if (this.state === this.STATES.ON_BREAK && this.todayData.breakStartTime) {
            this.todayData.breaks.push({ start: this.todayData.breakStartTime, end: now });
            this.todayData.breakStartTime = null;
        }

        this.todayData.totalBreakTime = this.calculateCompletedBreakTime(this.todayData);
        this.todayData.checkOutTime = now;
        this.todayData.workedTime = this.calculateWorkedTimeForSession(this.todayData);
        this.state = this.STATES.COMPLETED;

        this.saveData();
        this.updateUI();
    }

    calculateWorkedTime() {
        return this.calculateWorkedTimeForSession(this.todayData);
    }

    calculateWorkedTimeForSession(session) {
        if (!session || !session.checkInTime) {
            return 0;
        }

        const endTime = session.checkOutTime || Date.now();
        const totalTime = Math.max(0, endTime - session.checkInTime);

        let totalBreakTime = this.calculateCompletedBreakTime(session);
        if (session.breakStartTime && !session.checkOutTime) {
            totalBreakTime += Math.max(0, Date.now() - session.breakStartTime);
        }

        return Math.max(0, totalTime - totalBreakTime);
    }

    calculateCompletedBreakTime(session) {
        if (!session || !Array.isArray(session.breaks)) {
            return Math.max(0, Number(session?.totalBreakTime) || 0);
        }

        return session.breaks.reduce((sum, brk) => {
            const start = this.toNumberOrNull(brk?.start);
            const end = this.toNumberOrNull(brk?.end);
            if (!start || !end || end <= start) {
                return sum;
            }
            return sum + (end - start);
        }, 0);
    }

    reconcileStateFromTodayData() {
        if (!this.todayData?.checkInTime) {
            this.state = this.STATES.NOT_STARTED;
            return;
        }

        if (this.todayData.checkOutTime) {
            this.state = this.STATES.COMPLETED;
            return;
        }

        if (this.todayData.breakStartTime) {
            this.state = this.STATES.ON_BREAK;
            return;
        }

        this.state = this.STATES.CHECKED_IN;
    }

    getDailyTarget() {
        return this.settings.ramadanMode ? this.DEFAULT_TARGETS.ramadan : this.DEFAULT_TARGETS.normal;
    }

    updateUI() {
        this.reconcileStateFromTodayData();
        this.updateButtons();
        this.updateTimeDisplays();
        this.updateProgressRing();
        this.updateStatus();
        this.updateBreakTimeline();
    }

    updateButtons() {
        const { checkinBtn, breakStartBtn, breakStopBtn, checkoutBtn } = this.elements;

        [checkinBtn, breakStartBtn, breakStopBtn, checkoutBtn].forEach((btn) => {
            btn.disabled = true;
        });

        switch (this.state) {
            case this.STATES.NOT_STARTED:
                checkinBtn.disabled = false;
                break;
            case this.STATES.CHECKED_IN:
                breakStartBtn.disabled = false;
                checkoutBtn.disabled = false;
                break;
            case this.STATES.ON_BREAK:
                breakStopBtn.disabled = false;
                checkoutBtn.disabled = false;
                break;
            default:
                break;
        }
    }

    updateTimeDisplays() {
        const workedTime = this.calculateWorkedTime();
        const target = this.getDailyTarget();
        const remaining = Math.max(0, target - workedTime);

        this.elements.remainingTime.textContent = this.formatTime(remaining);
        this.elements.workedTime.textContent = this.formatTime(workedTime);
        
        this.elements.dailyTargets.forEach(el => el.textContent = this.formatTime(target));

        if (this.todayData.checkInTime) {
            const checkoutTimestamp = this.todayData.checkInTime + target + this.calculateActiveBreakTotal(this.todayData);
            const timeStr = this.formatClockTime(checkoutTimestamp, true);
            this.elements.estimatedCheckouts.forEach(el => el.textContent = timeStr);
        } else {
            this.elements.estimatedCheckouts.forEach(el => el.textContent = '-');
        }
    }

    updateProgressRing() {
        const workedTime = this.calculateWorkedTime();
        const target = this.getDailyTarget();
        const progress = target > 0 ? Math.min(1, workedTime / target) : 0;

        const circumference = 2 * Math.PI * 90;
        const offset = circumference - progress * circumference;

        this.elements.progressRing.style.strokeDashoffset = offset;

        if (progress >= 1) {
            this.elements.progressRing.classList.add('complete');
        } else {
            this.elements.progressRing.classList.remove('complete');
        }
    }

    updateStatus() {
        const statusText = {
            [this.STATES.NOT_STARTED]: 'Not Started',
            [this.STATES.CHECKED_IN]: 'Working',
            [this.STATES.ON_BREAK]: 'On Break',
            [this.STATES.COMPLETED]: 'Completed'
        };

        const statusStr = statusText[this.state] || 'Not Started';
        this.elements.currentStatuses.forEach(el => el.textContent = statusStr);
    }

    openSettings() {
        this.elements.settingsModal.classList.remove('hidden');
        this.elements.ramadanMode.checked = this.settings.ramadanMode;
    }

    closeSettings() {
        this.elements.settingsModal.classList.add('hidden');
    }

    openTimeEdit() {
        this.populateTimeEditForm();
        this.elements.timeEditModal.classList.remove('hidden');
    }

    closeTimeEdit() {
        this.elements.timeEditModal.classList.add('hidden');
    }

    switchScreen(screenName) {
        this.activeScreen = screenName === 'breaks' ? 'breaks' : 'main';
        const showingBreaks = this.activeScreen === 'breaks';

        this.elements.mainScreen.classList.toggle('hidden', showingBreaks);
        this.elements.breaksScreen.classList.toggle('hidden', !showingBreaks);
    }

    populateTimeEditForm() {
        this.elements.editCheckinTime.value = this.todayData.checkInTime
            ? this.formatTimeForInput(new Date(this.todayData.checkInTime))
            : '';

        this.elements.editCheckoutTime.value = this.todayData.checkOutTime
            ? this.formatTimeForInput(new Date(this.todayData.checkOutTime))
            : '';

        this.elements.breaksList.innerHTML = '';

        const breaks = Array.isArray(this.todayData.breaks) ? this.todayData.breaks : [];
        breaks.forEach((brk) => {
            this.appendBreakRow(
                this.formatTimeForInput(new Date(brk.start)),
                this.formatTimeForInput(new Date(brk.end))
            );
        });

        if (this.todayData.breakStartTime) {
            this.appendBreakRow(this.formatTimeForInput(new Date(this.todayData.breakStartTime)), '');
        }

        if (this.elements.breaksList.children.length === 0) {
            this.appendBreakRow();
        }
    }

    appendBreakRow(startValue = '', endValue = '') {
        const row = document.createElement('div');
        row.className = 'break-row';

        row.innerHTML = `
            <input type="time" class="time-input break-start-input" aria-label="Break start time" value="${startValue}" />
            <input type="time" class="time-input break-end-input" aria-label="Break end time" value="${endValue}" />
            <button type="button" class="clear-btn remove-break-btn">Remove</button>
        `;

        this.elements.breaksList.appendChild(row);
    }

    formatTimeForInput(date) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    parseTimeInput(value, dayStart) {
        if (!value) {
            return null;
        }

        const timeParts = value.split(':');
        if (timeParts.length !== 2) {
            return null;
        }

        const [hours, minutes] = timeParts.map(Number);
        if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
            return null;
        }

        const date = new Date(dayStart);
        date.setHours(hours, minutes, 0, 0);
        return date.getTime();
    }

    async saveTimeEdits() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = Date.now();

        const checkInTime = this.parseTimeInput(this.elements.editCheckinTime.value, today);
        const checkOutTime = this.parseTimeInput(this.elements.editCheckoutTime.value, today);

        if (checkOutTime && !checkInTime) {
            await this.showNotice('Set check-in time before check-out time.', 'Invalid Time');
            return;
        }

        if (checkInTime && checkOutTime && checkOutTime <= checkInTime) {
            await this.showNotice('Check-out time must be after check-in time.', 'Invalid Time');
            return;
        }

        if (checkOutTime && checkOutTime > now) {
            await this.showNotice('Check-out time cannot be in the future. Clear check-out to keep the timer running.', 'Invalid Time');
            return;
        }

        if (checkInTime && !checkOutTime && checkInTime > now) {
            await this.showNotice('Check-in time cannot be in the future. Use current or earlier machine time.', 'Invalid Time');
            return;
        }

        const breakRows = Array.from(this.elements.breaksList.querySelectorAll('.break-row'));
        const completedBreaks = [];
        let ongoingBreakStart = null;

        for (const row of breakRows) {
            const startValue = row.querySelector('.break-start-input')?.value || '';
            const endValue = row.querySelector('.break-end-input')?.value || '';

            if (!startValue && !endValue) {
                continue;
            }

            const start = this.parseTimeInput(startValue, today);
            const end = this.parseTimeInput(endValue, today);

            if (!start) {
                await this.showNotice('Each break must have a valid start time.', 'Invalid Time');
                return;
            }

            if (checkInTime && start <= checkInTime) {
                await this.showNotice('Break start time must be after check-in time.', 'Invalid Time');
                return;
            }

            if (!end) {
                if (checkOutTime) {
                    await this.showNotice('Break end time is required when check-out time is set.', 'Invalid Time');
                    return;
                }

                if (ongoingBreakStart) {
                    await this.showNotice('Only one ongoing break is allowed.', 'Invalid Time');
                    return;
                }

                if (start > now) {
                    await this.showNotice('Ongoing break start cannot be in the future.', 'Invalid Time');
                    return;
                }

                ongoingBreakStart = start;
                continue;
            }

            if (end <= start) {
                await this.showNotice('Break end time must be after break start time.', 'Invalid Time');
                return;
            }

            if (checkOutTime && end > checkOutTime) {
                await this.showNotice('Break end time must be before check-out time.', 'Invalid Time');
                return;
            }

            if (!checkOutTime && end > now) {
                await this.showNotice('Break end time cannot be in the future for an active session.', 'Invalid Time');
                return;
            }

            completedBreaks.push({ start, end });
        }

        completedBreaks.sort((a, b) => a.start - b.start);
        for (let i = 1; i < completedBreaks.length; i += 1) {
            if (completedBreaks[i].start < completedBreaks[i - 1].end) {
                await this.showNotice('Break times cannot overlap.', 'Invalid Time');
                return;
            }
        }

        if (!checkInTime && (completedBreaks.length > 0 || ongoingBreakStart)) {
            await this.showNotice('Set check-in time before adding breaks.', 'Invalid Time');
            return;
        }

        this.todayData.checkInTime = checkInTime;
        this.todayData.checkOutTime = checkOutTime;
        this.todayData.breaks = completedBreaks;
        this.todayData.breakStartTime = ongoingBreakStart;
        this.todayData.totalBreakTime = this.calculateCompletedBreakTime(this.todayData);
        this.todayData.workedTime = checkInTime ? this.calculateWorkedTimeForSession(this.todayData) : 0;

        this.reconcileStateFromTodayData();
        this.saveData();
        this.updateUI();
        this.closeTimeEdit();
    }

    showDialog({ title = 'Notice', message = '', confirmText = 'OK', cancelText = '' } = {}) {
        this.elements.dialogTitle.textContent = title;
        this.elements.dialogMessage.textContent = message;
        this.elements.dialogConfirm.textContent = confirmText;
        this.elements.dialogCancel.textContent = cancelText || 'Cancel';
        this.elements.dialogCancel.classList.toggle('hidden', !cancelText);
        this.elements.dialogModal.classList.remove('hidden');

        return new Promise((resolve) => {
            this.dialogResolver = resolve;
        });
    }

    closeDialog(confirmed) {
        if (this.elements.dialogModal.classList.contains('hidden')) {
            return;
        }

        this.elements.dialogModal.classList.add('hidden');
        const resolver = this.dialogResolver;
        this.dialogResolver = null;
        if (resolver) {
            resolver(Boolean(confirmed));
        }
    }

    showNotice(message, title = 'Notice') {
        return this.showDialog({ title, message, confirmText: 'OK' });
    }

    showConfirm(message, title = 'Confirm') {
        return this.showDialog({ title, message, confirmText: 'Yes', cancelText: 'No' });
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem(this.STORAGE_KEYS.theme, newTheme);
        this.updateThemeIcon(newTheme);
    }

    applyTheme() {
        const storedTheme = localStorage.getItem(this.STORAGE_KEYS.theme) || 'light';
        document.documentElement.setAttribute('data-theme', storedTheme);
        this.updateThemeIcon(storedTheme);
    }

    updateThemeIcon(theme) {
        const iconMarkup = theme === 'dark'
            ? '<svg class="icon icon-theme" viewBox="0 0 24 24" focusable="false"><path d="M14.7 3.5a1 1 0 0 1 .8 1.6 7.4 7.4 0 1 0 3.4 11.8 1 1 0 0 1 1.8.7A9.5 9.5 0 1 1 13.5 2.7a1 1 0 0 1 1.2.8Z"></path></svg>'
            : '<svg class="icon icon-theme" viewBox="0 0 24 24" focusable="false"><path d="M12 4.25A1 1 0 0 1 13 5.25V6a1 1 0 1 1-2 0v-.75a1 1 0 0 1 1-1Zm0 13.75a1 1 0 0 1 1 1v.75a1 1 0 1 1-2 0V19a1 1 0 0 1 1-1ZM5.9 6.64a1 1 0 0 1 1.41 0l.53.53a1 1 0 0 1-1.41 1.41l-.53-.53a1 1 0 0 1 0-1.41Zm10.26 10.26a1 1 0 0 1 1.41 0l.53.53a1 1 0 0 1-1.41 1.41l-.53-.53a1 1 0 0 1 0-1.41ZM4.25 12a1 1 0 0 1 1-1H6a1 1 0 1 1 0 2h-.75a1 1 0 0 1-1-1Zm13.75 0a1 1 0 0 1 1-1h.75a1 1 0 1 1 0 2H19a1 1 0 0 1-1-1ZM7.84 16.16a1 1 0 0 1 0 1.41l-.53.53a1 1 0 1 1-1.41-1.41l.53-.53a1 1 0 0 1 1.41 0Zm10.26-10.26a1 1 0 0 1 0 1.41l-.53.53a1 1 0 0 1-1.41-1.41l.53-.53a1 1 0 0 1 1.41 0ZM12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"></path></svg>';

        this.elements.themeToggle.querySelector('.theme-icon').innerHTML = iconMarkup;
        this.elements.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }

    updateBreakTimeline() {
        const checkinTime = this.todayData?.checkInTime;
        const breakStartTime = this.todayData?.breakStartTime;
        const completedBreaks = Array.isArray(this.todayData?.breaks) ? this.todayData.breaks : [];

        this.elements.breakCheckinTime.textContent = checkinTime ? this.formatClockTime(checkinTime) : '-';
        this.elements.breakCurrentStart.textContent = breakStartTime ? this.formatClockTime(breakStartTime) : '-';
        this.elements.breakTotalCount.textContent = String(completedBreaks.length + (breakStartTime ? 1 : 0));
        this.elements.breakTotalTime.textContent = this.formatTime(this.calculateActiveBreakTotal(this.todayData));

        if (checkinTime) {
            const checkoutTimestamp = checkinTime + this.getDailyTarget() + this.calculateActiveBreakTotal(this.todayData);
            this.elements.breakEstCheckout.textContent = this.formatClockTime(checkoutTimestamp, true);
        } else {
            this.elements.breakEstCheckout.textContent = '-';
        }

        const entries = completedBreaks.map((brk, index) => ({
            label: `Break ${index + 1}`,
            start: this.formatClockTime(brk.start),
            end: this.formatClockTime(brk.end),
            duration: this.formatTime(Math.max(0, brk.end - brk.start))
        }));

        if (breakStartTime) {
            entries.push({
                label: `Break ${entries.length + 1}`,
                start: this.formatClockTime(breakStartTime),
                end: 'In progress',
                duration: this.formatTime(Math.max(0, Date.now() - breakStartTime))
            });
        }

        this.elements.breakHistoryList.innerHTML = entries.map((entry) => `
            <div class="break-row-item">
                <div>
                    <div class="break-row-range">${entry.label}: ${entry.start} - ${entry.end}</div>
                </div>
                <div class="break-row-duration">${entry.duration}</div>
            </div>
        `).join('');

        this.elements.breakHistoryEmpty.classList.toggle('hidden', entries.length > 0);
    }

    calculateActiveBreakTotal(session) {
        const completed = this.calculateCompletedBreakTime(session);
        if (!session?.breakStartTime || session?.checkOutTime) {
            return completed;
        }
        return completed + Math.max(0, Date.now() - session.breakStartTime);
    }

    formatClockTime(timestamp, showSeconds = false) {
        if (!timestamp) {
            return '-';
        }

        const date = new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
            return '-';
        }

        const options = { hour: '2-digit', minute: '2-digit' };
        if (showSeconds) {
            options.second = '2-digit';
        }

        return date.toLocaleTimeString([], options);
    }

    checkDailyReset() {
        if (!this.todayData || !this.todayData.date || !this.isToday(this.todayData.date)) {
            this.performDailyReset();
        }
    }

    performDailyReset() {
        this.resetDailyData();
        this.state = this.STATES.NOT_STARTED;
        this.saveData();
    }

    resetDailyData() {
        this.todayData = this.createEmptyTodayData();
    }

    createEmptyTodayData() {
        return {
            date: this.getDateKey(new Date()),
            checkInTime: null,
            checkOutTime: null,
            breakStartTime: null,
            breaks: [],
            totalBreakTime: 0,
            workedTime: 0
        };
    }

    normalizeTodayData(todayData) {
        if (!todayData || typeof todayData !== 'object') {
            return null;
        }

        const dateKey = this.toDateKey(todayData.date);
        if (!dateKey) {
            return null;
        }

        const normalizedBreaks = this.normalizeBreaks(todayData.breaks);
        const breakStartTime = this.toNumberOrNull(todayData.breakStartTime);

        const normalized = {
            date: dateKey,
            checkInTime: this.toNumberOrNull(todayData.checkInTime),
            checkOutTime: this.toNumberOrNull(todayData.checkOutTime),
            breakStartTime,
            breaks: normalizedBreaks,
            totalBreakTime: Math.max(0, Number(todayData.totalBreakTime) || 0),
            workedTime: Math.max(0, Number(todayData.workedTime) || 0)
        };

        if (normalizedBreaks.length > 0) {
            normalized.totalBreakTime = this.calculateCompletedBreakTime(normalized);
        }

        return normalized;
    }

    normalizeBreaks(rawBreaks) {
        if (!Array.isArray(rawBreaks)) {
            return [];
        }

        return rawBreaks
            .map((item) => {
                const start = this.toNumberOrNull(item?.start);
                const end = this.toNumberOrNull(item?.end);
                if (!start || !end || end <= start) {
                    return null;
                }
                return { start, end };
            })
            .filter(Boolean)
            .sort((a, b) => a.start - b.start);
    }

    formatTime(milliseconds) {
        const safeMilliseconds = Math.max(0, Number(milliseconds) || 0);
        const totalSeconds = Math.floor(safeMilliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    isToday(dateString) {
        return this.toDateKey(dateString) === this.getDateKey(new Date());
    }

    getDateKey(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    toDateKey(value) {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return value;
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        return this.getDateKey(parsed);
    }

    toNumberOrNull(value) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue) || numberValue <= 0) {
            return null;
        }
        return numberValue;
    }

    safeParse(value, fallback) {
        if (!value) {
            return fallback;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            console.warn('Failed to parse storage value:', error);
            return fallback;
        }
    }

    startUpdateTimer() {
        if (this.updateInterval) {
            return;
        }

        this.updateInterval = setInterval(() => {
            this.updateUI();
        }, 1000);
    }

    stopUpdateTimer() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('Service Worker registered successfully:', registration);
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }

    destroy() {
        this.stopUpdateTimer();
        this.saveData();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.timeCalculator = new OfficeTimeCalculator();
});

document.addEventListener('visibilitychange', () => {
    if (!window.timeCalculator) {
        return;
    }

    if (document.hidden) {
        window.timeCalculator.stopUpdateTimer();
    } else {
        window.timeCalculator.checkDailyReset();
        window.timeCalculator.updateUI();
        window.timeCalculator.startUpdateTimer();
    }
});

window.addEventListener('beforeunload', () => {
    if (window.timeCalculator) {
        window.timeCalculator.destroy();
    }
});

window.addEventListener('online', () => {
    console.log('App is online');
});

window.addEventListener('offline', () => {
    console.log('App is offline');
});
