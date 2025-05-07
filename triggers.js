const triggersList = [
    { name: "net_monthly_inflow", label: "Net Monthly Inflow (> 0)", monthly: true, severity: "High" },
    { name: "monthly_balance_delta", label: "Monthly Balance Delta (Decline < 15% or increase)", monthly: true, severity: "Medium" },
    { name: "credit_debit_ratio", label: "Credit/Debit Ratio (> 1.0)", monthly: true, severity: "Medium" },
    { name: "liquidity_ratio", label: "Liquidity Ratio (>= 0.3)", monthly: true, severity: "High" },
    { name: "expense_income_ratio", label: "Expense/Income Ratio (< 0.85)", monthly: true, severity: "Medium" },
    { name: "account_turnover_ratio", label: "Account Turnover Ratio (< 4)", monthly: true, severity: "Medium" },
    { name: "cash_buffer_days", label: "Cash Buffer Days (>= 7 days)", monthly: true, severity: "High" },
    { name: "net_inflow_cv", label: "Net Inflow CV (< 0.5)", monthly: false, severity: "Low" },
    { name: "max_consecutive_negative_months", label: "Max Consecutive Negative Months (< 3)", monthly: false, severity: "High" },
    { name: "worst_monthly_net_inflow_pct_change", label: "Worst Monthly Net Inflow % Change (Decline <= 50%)", monthly: false, severity: "Medium" },
    { name: "salary_vs_credit_correlation", label: "Salary vs Credit Correlation (>= 0.75)", monthly: false, severity: "Low" },
    { name: "unusual_emi_pattern", label: "Unusual EMI Pattern (Max Gap > 60 days)", monthly: false, severity: "Low" }
];

// Store custom triggers
let customTriggers = [];
let selectedTriggers = [];
let selectedGroup = null;
let allTriggers = [];

function getAnalysisPeriod(latestDate) {
    const endDate = new Date(latestDate);
    const periods = [];
    for (let i = 0; i < 6; i++) {
        const date = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
        periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    return periods.reverse();
}

function filterTransactions(transactions, analysisPeriod) {
    return transactions.filter(txn => {
        const txnDate = new Date(txn.date);
        const txnMonth = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`;
        return analysisPeriod.includes(txnMonth);
    });
}

function calculatePaymentGaps(transactions) {
    const sortedTxns = transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    const gaps = [];
    for (let i = 1; i < sortedTxns.length; i++) {
        const d0 = new Date(sortedTxns[i - 1].date);
        const d1 = new Date(sortedTxns[i].date);
        const gap = (d1 - d0) / (1000 * 60 * 60 * 24);
        gaps.push({ gap, from: d0.toISOString().split('T')[0], to: d1.toISOString().split('T')[0] });
    }
    return gaps;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function fetchAllMobileNumbers() {
    try {
        console.log('Fetching all mobile numbers...');
        const response = await fetch('assets/mobile_numbers.json');
        if (!response.ok) throw new Error(`Failed to fetch mobile numbers: ${response.status}`);
        const data = await response.json();
        console.log('All mobile numbers fetched:', data.mobileNumbers.length);
        return data.mobileNumbers || [];
    } catch (e) {
        console.error('Error fetching mobile numbers:', e);
        return [];
    }
}

async function fetchMobileNumbers(group) {
    if (!group) {
        console.warn('No group provided for fetching mobile numbers.');
        return [];
    }

    const allMobileNumbers = await fetchAllMobileNumbers();
    if (allMobileNumbers.length === 0) {
        console.warn('No mobile numbers available in mobile_numbers.json.');
        return [];
    }

    console.log(`Filtering mobile numbers for group ${group}...`);
    const filteredMobileNumbers = [];

    // Check which mobile numbers belong to the selected group and have valid JSON
    await Promise.all(
        allMobileNumbers.map(async (mobile) => {
            try {
                const response = await fetch(`assets/user_groups_data/${group}/${mobile}_cleaned.json`);
                if (response.ok) {
                    // Attempt to parse the JSON to ensure it's valid
                    const data = await response.json();
                    if (data) {
                        filteredMobileNumbers.push(mobile);
                    }
                }
            } catch (e) {
                // File doesn't exist or JSON is invalid; skip this mobile number
                console.debug(`Skipping ${mobile} in group ${group}: ${e.message}`);
            }
        })
    );

    console.log(`Filtered mobile numbers for group ${group}:`, filteredMobileNumbers.length);
    return filteredMobileNumbers.sort(); // Sort for consistency
}

async function fetchCustomerData(group, mobile) {
    try {
        console.log(`Fetching data for ${mobile} in group ${group}...`);
        const response = await fetch(`assets/user_groups_data/${group}/${mobile}_cleaned.json`);
        if (!response.ok) {
            console.warn(`No data found for ${mobile} in group ${group}: ${response.status}`);
            return null;
        }
        // Attempt to parse JSON, catch parsing errors
        let data;
        try {
            data = await response.json();
        } catch (e) {
            console.warn(`Invalid JSON for ${mobile} in group ${group}: ${e.message}`);
            return null;
        }
        console.log(`Data fetched for ${mobile}`);
        return data;
    } catch (e) {
        console.error(`Error fetching data for ${mobile} in group ${group}:`, e);
        return null;
    }
}

function populateTriggersCheckboxes() {
    const checkboxesDiv = document.getElementById('triggers-checkboxes');
    checkboxesDiv.innerHTML = '';

    const allTriggers = [...triggersList, ...customTriggers];
    allTriggers.forEach(trigger => {
        const div = document.createElement('div');
        div.className = 'flex items-center';
        div.innerHTML = `
            <input type="checkbox" id="trigger-${trigger.name}" value="${trigger.name}" class="mr-2 h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded">
            <label for="trigger-${trigger.name}" class="text-sm">${trigger.label}</label>
        `;
        checkboxesDiv.appendChild(div);
    });
}

async function applyTriggers() {
    const spinner = document.getElementById('loading-spinner');
    spinner.classList.remove('hidden');

    selectedGroup = document.getElementById('select-group').value;
    if (!selectedGroup) {
        alert('Please select a user group.');
        spinner.classList.add('hidden');
        return;
    }

    selectedTriggers = [];
    document.querySelectorAll('#triggers-checkboxes input:checked').forEach(checkbox => {
        selectedTriggers.push(checkbox.value);
    });

    if (selectedTriggers.length === 0) {
        alert('Please select at least one trigger to apply.');
        spinner.classList.add('hidden');
        return;
    }

    const mobileNumbers = await fetchMobileNumbers(selectedGroup);
    if (mobileNumbers.length === 0) {
        displayTriggers([], true);
        spinner.classList.add('hidden');
        return;
    }

    const triggers = [];
    const currentDate = new Date('2025-05-06');
    const analysisPeriod = getAnalysisPeriod(currentDate.toISOString().split('T')[0]);

    let processedCustomers = 0;
    for (const mobile of mobileNumbers) {
        const data = await fetchCustomerData(selectedGroup, mobile);
        if (!data) continue;

        processedCustomers++;
        const monthlyDetails = data.monthlyDetails || [];
        const salaryXns = data.salaryXns || [];
        const eODBalances = data.eODBalances || [];
        const emis = data.eMIECSLOANXns || [];

        // Compute current balance (latest from eODBalances)
        let currentBalance = null;
        if (eODBalances.length > 0) {
            eODBalances.sort((a, b) => new Date(b.date) - new Date(b.date));
            currentBalance = eODBalances[0].balance;
        }

        // Compute NACH EMI metrics
        const filtered = filterTransactions(emis, analysisPeriod);
        const totalEMI = filtered.reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
        const gaps = calculatePaymentGaps(filtered);
        const avgGap = gaps.length > 0 ? gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length : 0;

        // Compute features for monthly details
        const monthlyData = monthlyDetails.map(m => ({
            ...m,
            month_dt: new Date(m.monthName + '-01')
        })).sort((a, b) => a.month_dt - b.month_dt);

        const latestDate = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].month_dt : null;
        const sixMonthsAgo = latestDate ? new Date(latestDate.getFullYear(), latestDate.getMonth() - 5, 1) : null;
        const filteredMonthlyData = sixMonthsAgo ? monthlyData.filter(m => m.month_dt >= sixMonthsAgo) : monthlyData;

        const monthlyFeatures = filteredMonthlyData.map(m => {
            const totalCredit = Number(m.totalCredit) || 0;
            const totalDebit = Number(m.totalDebit) || 0;
            const balOpen = Number(m.balOpen) || 0;
            const balLast = Number(m.balLast) || 0;
            const balAvg = Number(m.balAvg) || 0;
            const credits = Number(m.credits) || 0;
            const debits = Number(m.debits) || 0;

            return {
                monthName: m.monthName,
                net_monthly_inflow: totalCredit - totalDebit,
                monthly_balance_delta: balLast - balOpen,
                credit_debit_ratio: totalDebit !== 0 ? totalCredit / totalDebit : null,
                liquidity_ratio: totalDebit !== 0 ? balAvg / totalDebit : null,
                expense_income_ratio: totalCredit !== 0 ? totalDebit / totalCredit : null,
                account_turnover_ratio: balAvg !== 0 ? (credits + debits) / balAvg : null,
                cash_buffer_days: (totalDebit / 30.0) !== 0 ? balAvg / (totalDebit / 30.0) : null
            };
        });

        // Compute overall features
        const netInflows = monthlyFeatures.map(m => m.net_monthly_inflow);
        const meanInflow = netInflows.reduce((sum, val) => sum + val, 0) / netInflows.length;
        const stdInflow = Math.sqrt(netInflows.reduce((sum, val) => sum + Math.pow(val - meanInflow, 2), 0) / netInflows.length);
        const net_inflow_cv = meanInflow !== 0 ? stdInflow / Math.abs(meanInflow) : null;

        let max_consecutive_negative_months = 0;
        let currentStreak = 0;
        netInflows.forEach(val => {
            if (val < 0) {
                currentStreak++;
                max_consecutive_negative_months = Math.max(max_consecutive_negative_months, currentStreak);
            } else {
                currentStreak = 0;
            }
        });

        const netInflowPctChanges = [];
        for (let i = 1; i < netInflows.length; i++) {
            const prev = netInflows[i - 1];
            const curr = netInflows[i];
            if (prev !== 0) {
                netInflowPctChanges.push(((curr - prev) / prev) * 100);
            }
        }
        const worst_monthly_net_inflow_pct_change = netInflowPctChanges.length > 0 ? Math.min(...netInflowPctChanges) : null;

        const salaryByMonth = {};
        salaryXns.forEach(sxn => {
            const date = new Date(sxn.date);
            const monthName = date.toLocaleString('default', { month: 'short', year: '2-digit' });
            salaryByMonth[monthName] = (salaryByMonth[monthName] || 0) + (Number(sxn.amount) || 0);
        });

        const salaryCredits = monthlyFeatures.map(m => ({
            salary: salaryByMonth[m.monthName] || 0,
            credit: Number(m.totalCredit) || 0
        }));
        const salaryMean = salaryCredits.reduce((sum, val) => sum + val.salary, 0) / salaryCredits.length;
        const creditMean = salaryCredits.reduce((sum, val) => sum + val.credit, 0) / salaryCredits.length;
        let covariance = 0, salaryVariance = 0, creditVariance = 0;
        salaryCredits.forEach(sc => {
            covariance += (sc.salary - salaryMean) * (sc.credit - creditMean);
            salaryVariance += Math.pow(sc.salary - salaryMean, 2);
            creditVariance += Math.pow(sc.credit - creditMean, 2);
        });
        const salary_vs_credit_correlation = (salaryVariance * creditVariance) !== 0 ? 
            covariance / Math.sqrt(salaryVariance * creditVariance) : null;

        // Apply selected triggers
        const allTriggersList = [...triggersList, ...customTriggers];
        selectedTriggers.forEach(triggerName => {
            const trigger = allTriggersList.find(t => t.name === triggerName);
            if (!trigger) return;

            if (trigger.monthly) {
                monthlyFeatures.forEach(m => {
                    let pass = false;
                    let value = m[trigger.name];
                    let details = "";
                    switch (trigger.name) {
                        case 'net_monthly_inflow':
                            pass = value > 0;
                            details = `Net Inflow: ₹${value.toFixed(2)}`;
                            break;
                        case 'monthly_balance_delta':
                            const declinePct = m.balOpen !== 0 ? (m.monthly_balance_delta / m.balOpen) : null;
                            pass = declinePct === null || declinePct <= 0.15 || m.monthly_balance_delta > 0;
                            value = declinePct !== null ? (declinePct * 100) : null;
                            details = `Balance Delta: ${value !== null ? value.toFixed(2) + '%' : 'N/A'}`;
                            break;
                        case 'credit_debit_ratio':
                            pass = value !== null && value > 1.0;
                            details = `Ratio: ${value !== null ? value.toFixed(2) : 'N/A'}`;
                            break;
                        case 'liquidity_ratio':
                            pass = value !== null && value >= 0.3;
                            details = `Ratio: ${value !== null ? value.toFixed(2) : 'N/A'}`;
                            break;
                        case 'expense_income_ratio':
                            pass = value !== null && value < 0.85;
                            details = `Ratio: ${value !== null ? value.toFixed(2) : 'N/A'}`;
                            break;
                        case 'account_turnover_ratio':
                            pass = value !== null && value < 4;
                            details = `Ratio: ${value !== null ? value.toFixed(2) : 'N/A'}`;
                            break;
                        case 'cash_buffer_days':
                            pass = value !== null && value >= 7;
                            details = `Days: ${value !== null ? value.toFixed(1) : 'N/A'}`;
                            break;
                    }
                    if (!pass) {
                        triggers.push({
                            mobile,
                            group: selectedGroup,
                            type: trigger.label,
                            details: `${m.monthName}: ${details}`,
                            severity: trigger.severity,
                            date: formatDate(currentDate)
                        });
                    }
                });
            } else {
                let pass = false;
                let value = null;
                let details = "";
                switch (trigger.name) {
                    case 'net_inflow_cv':
                        value = net_inflow_cv;
                        pass = value !== null && value < 0.5;
                        details = `CV: ${value !== null ? value.toFixed(2) : 'N/A'}`;
                        break;
                    case 'max_consecutive_negative_months':
                        value = max_consecutive_negative_months;
                        pass = value < 3;
                        details = `Months: ${value}`;
                        break;
                    case 'worst_monthly_net_inflow_pct_change':
                        value = worst_monthly_net_inflow_pct_change;
                        pass = value !== null && value >= -50;
                        details = `Change: ${value !== null ? value.toFixed(2) + '%' : 'N/A'}`;
                        break;
                    case 'salary_vs_credit_correlation':
                        value = salary_vs_credit_correlation;
                        pass = value !== null && value >= 0.75;
                        details = `Correlation: ${value !== null ? value.toFixed(2) : 'N/A'}`;
                        break;
                    case 'unusual_emi_pattern':
                        if (gaps.length > 0) {
                            const maxGap = Math.max(...gaps.map(g => g.gap));
                            pass = maxGap <= 60;
                            details = `Max EMI Gap: ${maxGap} days`;
                            if (!pass) {
                                triggers.push({
                                    mobile,
                                    group: selectedGroup,
                                    type: trigger.label,
                                    details,
                                    severity: trigger.severity,
                                    date: formatDate(currentDate)
                                });
                            }
                        }
                        return; // Skip adding trigger if pass or no gaps
                }
                if (!pass) {
                    triggers.push({
                        mobile,
                        group: selectedGroup,
                        type: trigger.label,
                        details,
                        severity: trigger.severity,
                        date: formatDate(currentDate)
                    });
                }
            }
        });
    }

    console.log('Processed customers:', processedCustomers);
    console.log('Triggers generated:', triggers);
    allTriggers = triggers;
    displayTriggers(triggers, processedCustomers === 0);
    setupFilters(triggers);
    spinner.classList.add('hidden');
}

function displayTriggers(triggers, noDataFetched = false) {
    const tbody = document.getElementById('triggers-table-body');
    tbody.innerHTML = '';

    if (noDataFetched) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" class="py-3 px-4 text-center text-red-500">Failed to fetch customer data. Please ensure the data files (e.g., assets/mobile_numbers.json, assets/user_groups_data/${selectedGroup}/[mobile]_cleaned.json) are accessible and contain valid JSON.</td>`;
        tbody.appendChild(row);
        return;
    }

    if (triggers.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" class="py-3 px-4 text-center">No triggers found for the selected group and criteria.</td>`;
        tbody.appendChild(row);
        return;
    }

    triggers.forEach(trigger => {
        const row = document.createElement('tr');
        row.className = trigger.severity === 'High' ? 'list-group-item-warning' : '';
        row.innerHTML = `
            <td class="py-3 px-4">${trigger.mobile}</td>
            <td class="py-3 px-4">${trigger.group}</td>
            <td class="py-3 px-4">${trigger.type}</td>
            <td class="py-3 px-4">${trigger.details}</td>
            <td class="py-3 px-4">${trigger.severity}</td>
            <td class="py-3 px-4">${trigger.date}</td>
        `;
        tbody.appendChild(row);
    });
}

function setupFilters(triggers) {
    const severityFilter = document.getElementById('severity-filter');

    function filterTriggers() {
        let filteredTriggers = [...allTriggers];
        const severity = severityFilter.value;

        if (severity !== 'all') {
            filteredTriggers = filteredTriggers.filter(trigger => trigger.severity === severity);
        }

        displayTriggers(filteredTriggers);
    }

    severityFilter.addEventListener('change', filterTriggers);

    filterTriggers();
}

document.addEventListener('DOMContentLoaded', () => {
    populateTriggersCheckboxes();
    document.getElementById('apply-triggers').addEventListener('click', applyTriggers);
});