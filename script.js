const mockFeatureData = {
    derivedMonthlyFeatures: [
        { monthName: "Jan-25", net_monthly_inflow: 5000, monthly_balance_delta: 1000, credit_debit_ratio: 1.2, liquidity_ratio: 0.4, expense_income_ratio: 0.7 },
        { monthName: "Feb-25", net_monthly_inflow: 4500, monthly_balance_delta: 800, credit_debit_ratio: 1.1, liquidity_ratio: 0.35, expense_income_ratio: 0.75 }
    ]
};
const mockEwsData = {
    ewsDetected: [
        { signal: "Frequent Low Balances", severity: "High", evidence: "Found 3 transactions with balance <= ₹100", recommendation: "Engage customer..." },
        { signal: "High Debit-to-Credit Ratio", severity: "Medium", evidence: "Ratio: 1.5", recommendation: "Analyze spending..." }
    ]
};
const mockNachData = {
    alerts: [
        "INFO: 3 EMI transactions found in the last 6 months.",
        "ALERT: Underpayment in 2025-03. Actual: 4000.00, Expected: 5000.00",
        "INFO: Next EMI payment for 5000.00 predicted on 2025-06-05."
    ]
};

async function fetchMobileNumbers() {
    try {
        const response = await fetch('assets/mobile_numbers.json');
        if (!response.ok) throw new Error('Failed to fetch mobile numbers');
        const data = await response.json();
        return data.mobileNumbers;
    } catch (e) {
        console.error('Error fetching mobile numbers:', e);
        // Fallback to an empty array if fetching fails
        return [];
    }
}

async function initializeDashboard() {
    const mobileNumbers = await fetchMobileNumbers();
    const mobileList = document.getElementById('mobile-list');

    if (mobileNumbers.length === 0) {
        mobileList.innerHTML = '<li class="nav-item">No mobile numbers found.</li>';
        return;
    }

    mobileNumbers.forEach(mobile => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        li.innerHTML = `<a class="nav-link" onclick="loadReports('${mobile}', this)">${mobile}</a>`;
        mobileList.appendChild(li);
    });

    if (mobileNumbers.length > 0) {
        loadReports(mobileNumbers[0], mobileList.querySelector('.nav-link'));
    }
}

async function loadReports(mobile, element) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    element.classList.add('active');

    document.getElementById('features-content').innerHTML = '<div class="spinner"></div>';
    document.getElementById('ews-content').innerHTML = '<div class="spinner"></div>';
    document.getElementById('nach-content').innerHTML = '<div class="spinner"></div>';
    document.getElementById('trend-plot').src = '';

    // Load Feature Report
    let featureData = mockFeatureData;
    try {
        const featureResp = await fetch(`assets/features/${mobile}_Report.json`);
        if (!featureResp.ok) throw new Error('Fetch failed');
        featureData = await featureResp.json();
    } catch (e) {
        console.error('Error loading feature report:', e);
        document.getElementById('features-content').innerText = 'Using sample data due to error loading feature report.';
        featureData = mockFeatureData;
    } finally {
        const table = createFeatureTable(featureData.derivedMonthlyFeatures);
        document.getElementById('features-content').innerHTML = '';
        document.getElementById('features-content').appendChild(table);
        document.getElementById('trend-plot').src = `assets/features/${mobile}_trends.png`;
    }

    // Load EWS Report
    let ewsData = mockEwsData;
    try {
        const ewsResp = await fetch(`assets/ews_reports/${mobile}_ews_report.json`);
        if (!ewsResp.ok) throw new Error('Fetch failed');
        ewsData = await ewsResp.json();
    } catch (e) {
        console.error('Error loading EWS report:', e);
        document.getElementById('ews-content').innerText = 'Using sample data due to error loading EWS report.';
        ewsData = mockEwsData;
    } finally {
        const ewsDiv = document.createElement('div');
        ewsData.ewsDetected.forEach(signal => {
            const severityClass = signal.severity === 'High' ? 'text-danger' : 'text-warning';
            ewsDiv.innerHTML += `
                <div class="card">
                    <div class="card-header">${signal.signal}</div>
                    <div class="card-body">
                        <p><strong>Severity:</strong> <span class="${severityClass}">${signal.severity}</span></p>
                        <p><strong>Evidence:</strong> ${signal.evidence}</p>
                        <p><strong>Recommendation:</strong> ${signal.recommendation}</p>
                    </div>
                </div>`;
        });
        document.getElementById('ews-content').innerHTML = '';
        document.getElementById('ews-content').appendChild(ewsDiv);
    }

    // Load NACH Report
    let nachData = mockNachData;
    try {
        const nachResp = await fetch(`assets/nach_reports/${mobile}_nach_report.json`);
        if (!nachResp.ok) throw new Error('Fetch failed');
        nachData = await nachResp.json();
    } catch (e) {
        console.error('Error loading NACH report:', e);
        document.getElementById('nach-content').innerText = 'Using sample data due to error loading NACH report.';
        nachData = mockNachData;
    } finally {
        const nachDiv = document.createElement('div');
        nachData.alerts.forEach(alert => {
            let alertClass = 'alert-info';
            if (alert.startsWith('ALERT')) alertClass = 'alert-danger';
            else if (alert.startsWith('WARNING')) alertClass = 'alert-warning';
            else if (alert.startsWith('INFO') || alert.startsWith('NOTICE')) alertClass = 'alert-success';
            nachDiv.innerHTML += `<p class="${alertClass}">${alert}</p>`;
        });
        document.getElementById('nach-content').innerHTML = '';
        document.getElementById('nach-content').appendChild(nachDiv);
    }
}

function createFeatureTable(data) {
    const table = document.createElement('table');
    table.className = 'table table-bordered table-hover';
    const headers = ['Month', 'Net Inflow (₹)', 'Balance Delta (₹)', 'Credit/Debit Ratio', 'Liquidity Ratio', 'Expense/Income Ratio'];
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.innerText = header;
        tr.appendChild(th);
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.forEach(row => {
        const tr = document.createElement('tr');
        ['monthName', 'net_monthly_inflow', 'monthly_balance_delta', 'credit_debit_ratio', 'liquidity_ratio', 'expense_income_ratio']
            .forEach(key => {
                const td = document.createElement('td');
                td.innerText = row[key] !== null && !isNaN(row[key]) ? Number(row[key]).toFixed(2) : 'N/A';
                tr.appendChild(td);
            });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

// Initialize the dashboard by fetching mobile numbers
initializeDashboard();