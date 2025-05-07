const ewsList = [
    { name: "low_balances", label: "Frequent Low or Near-Zero Balances (Balance <= ₹100, ≥3 times)", severity: "High" },
    { name: "high_transaction_volume", label: "High Transaction Volume with Small-Value Transfers (>30 small txns/month)", severity: "Medium" },
    { name: "post_salary_transfers", label: "Significant Fund Transfers Post-Salary Credits (Debits ≥ 50% of salary)", severity: "High" },
    { name: "below_min_balance", label: "Below Minimum Balance Charges", severity: "Medium" },
    { name: "inconsistent_salary", label: "Inconsistent Salary Credits (Deviations > 20% from mean)", severity: "Medium" },
    { name: "debit_credit_ratio", label: "High Debit-to-Credit Ratio (> 1.0)", severity: "Medium" },
    { name: "informal_borrowing", label: "Potential Informal Borrowing or Lending (≥₹10,000, ≥3 times)", severity: "Medium" },
    { name: "limited_loan_repayment", label: "Limited Loan Repayment Activity (Repayment ratio < 0.1)", severity: "Medium" },
    { name: "balance_volatility", label: "High Volatility in Account Balance (Volatility > 0.5)", severity: "Medium" },
    { name: "sporadic_large_credits", label: "Sporadic Large Credits (≥₹50,000, non-salary, ≤2/month)", severity: "Medium" },
    { name: "irregular_emi_payments", label: "Irregular EMI Payments (Avg Payment Gap > 35 days)", severity: "High" },
    { name: "insufficient_emi_payments", label: "Insufficient EMI Payments (Total EMI < 10% of Latest Balance)", severity: "High" }
];

let selectedGroup = null;
let selectedEWS = [];
let allWarnings = [];

function populateEWSCheckboxes() {
    console.log('Populating EWS checkboxes...');
    const checkboxesDiv = document.getElementById('ews-checkboxes');
    if (!checkboxesDiv) {
        console.error('EWS checkboxes div not found!');
        return;
    }
    checkboxesDiv.innerHTML = '';

    // Add "Select All" checkbox
    const selectAllDiv = document.createElement('div');
    selectAllDiv.className = 'flex items-center mb-2';
    selectAllDiv.innerHTML = `
        <input type="checkbox" id="select-all-ews" class="mr-2 h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded">
        <label for="select-all-ews" class="text-sm font-medium">Select All</label>
    `;
    checkboxesDiv.appendChild(selectAllDiv);

    // Add individual EWS checkboxes
    ewsList.forEach(ews => {
        const div = document.createElement('div');
        div.className = 'flex items-center';
        div.innerHTML = `
            <input type="checkbox" id="ews-${ews.name}" value="${ews.name}" class="mr-2 h-4 w-4 text-orange-500 focus:ring-orange-500 border-gray-300 rounded ews-checkbox">
            <label for="ews-${ews.name}" class="text-sm">${ews.label}</label>
        `;
        checkboxesDiv.appendChild(div);
    });

    // Handle "Select All" functionality
    const selectAllCheckbox = document.getElementById('select-all-ews');
    const ewsCheckboxes = document.querySelectorAll('.ews-checkbox');
    selectAllCheckbox.addEventListener('change', () => {
        console.log('Select All checkbox changed:', selectAllCheckbox.checked);
        const isChecked = selectAllCheckbox.checked;
        ewsCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
        });
    });

    // Update "Select All" checkbox state based on individual checkboxes
    ewsCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const allChecked = Array.from(ewsCheckboxes).every(cb => cb.checked);
            const someChecked = Array.from(ewsCheckboxes).some(cb => cb.checked);
            selectAllCheckbox.checked = allChecked;
            selectAllCheckbox.indeterminate = someChecked && !allChecked;
        });
    });
}

async function fetchMobileNumbers() {
    try {
        console.log('Fetching mobile numbers...');
        const response = await fetch('assets/mobile_numbers.json');
        if (!response.ok) throw new Error(`Failed to fetch mobile numbers: ${response.status}`);
        const data = await response.json();
        console.log('Mobile numbers fetched:', data.mobileNumbers.length);
        return data.mobileNumbers;
    } catch (e) {
        console.error('Error fetching mobile numbers:', e);
        return [];
    }
}

async function fetchCustomerData(group, mobile) {
    try {
        console.log(`Fetching data for ${mobile} in group ${group}...`);
        const response = await fetch(`assets/user_groups_data/${group}/${mobile}_cleaned.json`);
        if (!response.ok) {
            console.warn(`No data found for ${mobile} in group ${group}: ${response.status}`);
            return null;
        }
        const data = await response.json();
        console.log(`Data fetched for ${mobile}`);
        return data;
    } catch (e) {
        console.error(`Error fetching data for ${mobile} in group ${group}:`, e);
        return null;
    }
}

function isValidDateString(dateString) {
    if (typeof dateString !== 'string' || !dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime()); // Returns true if date is valid
}

function getLatestMonth(transactions) {
    if (!transactions || transactions.length === 0) return null;
    const validTransactions = transactions.filter(txn => isValidDateString(txn.date));
    if (validTransactions.length === 0) return null;
    const dates = validTransactions.map(txn => new Date(txn.date));
    const latestDate = new Date(Math.max(...dates));
    return `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}`;
}

function filter6Months(transactions, latestMonth) {
    if (!latestMonth || !transactions) return [];
    const latestDate = new Date(latestMonth + '-01');
    const startDate = new Date(latestDate.getFullYear(), latestDate.getMonth() - 5, 1);
    const startMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
    const endMonth = latestMonth;

    return transactions.filter(txn => {
        if (!isValidDateString(txn.date)) {
            console.warn(`Invalid date in transaction: ${JSON.stringify(txn)}`);
            return false;
        }
        const txnMonth = txn.date.substring(0, 7);
        return startMonth <= txnMonth && txnMonth <= endMonth;
    });
}

function getAnalysisPeriod(latestDate) {
    if (!isValidDateString(latestDate)) return [];
    const endDate = new Date(latestDate);
    const periods = [];
    for (let i = 0; i < 6; i++) {
        const date = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
        periods.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    return periods.reverse();
}

function filterTransactions(transactions, analysisPeriod) {
    if (!transactions || !analysisPeriod) return [];
    return transactions.filter(txn => {
        if (!isValidDateString(txn.date)) {
            console.warn(`Invalid date in transaction: ${JSON.stringify(txn)}`);
            return false;
        }
        const txnDate = new Date(txn.date);
        const txnMonth = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`;
        return analysisPeriod.includes(txnMonth);
    });
}

function calculatePaymentGaps(transactions) {
    const validTransactions = transactions.filter(txn => isValidDateString(txn.date));
    const sortedTxns = validTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    const gaps = [];
    for (let i = 1; i < sortedTxns.length; i++) {
        const d0 = new Date(sortedTxns[i - 1].date);
        const d1 = new Date(sortedTxns[i].date);
        const gap = (d1 - d0) / (1000 * 60 * 60 * 24);
        gaps.push({ gap, from: d0.toISOString().split('T')[0], to: d1.toISOString().split('T')[0] });
    }
    return gaps;
}

function calculateSummaryInfo(transactions) {
    const totalCredit = transactions.reduce((sum, txn) => sum + (txn.amount > 0 ? txn.amount : 0), 0);
    const totalDebit = transactions.reduce((sum, txn) => sum + (txn.amount < 0 ? -txn.amount : 0), 0);
    const creditCount = transactions.filter(txn => txn.amount > 0).length;
    const debitCount = transactions.filter(txn => txn.amount < 0).length;
    const loanDisbursal = transactions
        .filter(txn => txn.category === 'loan_disbursed')
        .reduce((sum, txn) => sum + txn.amount, 0);
    const emiIssues = transactions
        .filter(txn => txn.category === 'emi_ecs_loan_issue')
        .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

    return {
        total: {
            totalCredit,
            totalDebit,
            credits: creditCount,
            debits: debitCount,
            totalLoanDisbursal: loanDisbursal,
            totalEmiEcsLoanIssue: emiIssues
        }
    };
}

function formatDate(dateString) {
    if (!isValidDateString(dateString)) return 'Invalid Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// EWS Detection Functions
function detectLowBalances(transactions, threshold = 100.0) {
    const lowBalanceTxns = transactions.filter(txn => txn.balance <= threshold);
    const lowBalanceCount = lowBalanceTxns.length;
    if (lowBalanceCount >= 3) {
        return {
            signal: 'Frequent Low or Near-Zero Balances',
            severity: 'High',
            evidence: `Found ${lowBalanceCount} transactions with balance <= ₹${threshold}: ${lowBalanceTxns.slice(0, 5).map(t => t.txnid).join(', ')}`,
            recommendation: 'Engage customer to assess liquidity issues and offer repayment restructuring.',
            events: lowBalanceTxns.map(t => ({ txnid: t.txnid, date: t.date, balance: t.balance }))
        };
    }
    return null;
}

function detectHighTransactionVolume(transactions, threshold = 30) {
    const smallTxns = transactions.filter(txn => Math.abs(txn.amount) <= 500);
    const monthlyCounts = {};
    smallTxns.forEach(txn => {
        if (!isValidDateString(txn.date)) {
            console.warn(`Invalid date in transaction: ${JSON.stringify(txn)}`);
            return;
        }
        const month = txn.date.substring(0, 7);
        monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
    });
    const highVolumeMonths = Object.keys(monthlyCounts).filter(month => monthlyCounts[month] > threshold);
    if (highVolumeMonths.length > 0) {
        return {
            signal: 'High Transaction Volume with Small-Value Transfers',
            severity: 'Medium',
            evidence: `Months with >${threshold} small transactions (<=₹500): ${highVolumeMonths.join(', ')}`,
            recommendation: 'Investigate purpose of small transfers to rule out fund diversion.',
            events: []
        };
    }
    return null;
}

function detectPostSalaryTransfers(transactions, salaryXns, threshold = 0.5) {
    // Filter out invalid salary transactions
    const validSalaryXns = salaryXns.filter(sxn => isValidDateString(sxn.date));
    if (validSalaryXns.length === 0) {
        console.warn('No valid salary transactions found for detecting post-salary transfers.');
        return null;
    }

    const salaryDates = validSalaryXns.reduce((acc, sxn) => {
        acc[sxn.date] = sxn.amount;
        return acc;
    }, {});

    // Filter out invalid transactions
    const validTransactions = transactions.filter(txn => isValidDateString(txn.date));
    if (validTransactions.length === 0) {
        console.warn('No valid transactions found for detecting post-salary transfers.');
        return null;
    }

    const significantTransfers = validTransactions.filter(txn => {
        if (txn.amount >= 0) return false;
        const txnDate = txn.date;
        const txnDateObj = new Date(txnDate);
        for (const [salaryDate, salaryAmount] of Object.entries(salaryDates)) {
            const salaryDateObj = new Date(salaryDate);
            const sameMonth = txnDate.substring(0, 7) === salaryDate.substring(0, 7);
            const daysDiff = Math.abs((txnDateObj - salaryDateObj) / (1000 * 60 * 60 * 24));
            if (txnDate === salaryDate || (sameMonth && daysDiff <= 2)) {
                if (Math.abs(txn.amount) >= salaryAmount * threshold) {
                    return true;
                }
            }
        }
        return false;
    }).map(txn => ({ txnid: txn.txnid, date: txn.date, amount: txn.amount }));

    if (significantTransfers.length > 0) {
        return {
            signal: 'Significant Fund Transfers Post-Salary Credits',
            severity: 'High',
            evidence: `Found ${significantTransfers.length} large debits post-salary: ${significantTransfers.slice(0, 5).map(t => t.txnid).join(', ')}`,
            recommendation: 'Monitor salary inflows and enforce EMI prioritization.',
            events: significantTransfers
        };
    }
    return null;
}

function detectBelowMinBalance(transactions) {
    const ambCharges = transactions
        .filter(txn => (txn.narration || '').includes('AMB CHRG'))
        .map(txn => ({ txnid: txn.txnid, date: txn.date, amount: txn.amount }));
    if (ambCharges.length > 0) {
        return {
            signal: 'Below Minimum Balance Charges',
            severity: 'Medium',
            evidence: `Found ${ambCharges.length} charges: ${ambCharges.map(t => t.txnid).join(', ')}`,
            recommendation: 'Alert customer about penalties and assess repayment capacity.',
            events: ambCharges
        };
    }
    return null;
}

function detectInconsistentSalary(salaryXns, threshold = 0.2) {
    const validSalaryXns = salaryXns.filter(sxn => isValidDateString(sxn.date));
    if (!validSalaryXns || validSalaryXns.length < 2) return null;
    const amounts = validSalaryXns.map(sxn => sxn.amount);
    const meanSalary = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const deviations = amounts.map(amt => Math.abs(amt - meanSalary) / meanSalary);
    const inconsistent = validSalaryXns.filter((sxn, i) => deviations[i] > threshold)
        .map(sxn => ({ txnid: sxn.txnid, date: sxn.date, amount: sxn.amount }));
    if (inconsistent.length > 0) {
        return {
            signal: 'Inconsistent Salary Credits',
            severity: 'Medium',
            evidence: `Found ${inconsistent.length} salaries deviating >${threshold*100}% from mean ₹${meanSalary.toFixed(2)}: ${inconsistent.map(t => t.txnid).join(', ')}`,
            recommendation: 'Verify income stability with employer.',
            events: inconsistent
        };
    }
    return null;
}

function detectDebitCreditRatio(summaryInfo, threshold = 1.0) {
    const totalDebit = summaryInfo.total.totalDebit || 0;
    const totalCredit = summaryInfo.total.totalCredit || 0;
    const debitCount = summaryInfo.total.debits || 0;
    const creditCount = summaryInfo.total.credits || 0;
    if (totalCredit === 0 || creditCount === 0) return null;
    const amountRatio = totalDebit / totalCredit;
    const countRatio = debitCount / creditCount;
    if (amountRatio > threshold || countRatio > threshold) {
        return {
            signal: 'High Debit-to-Credit Ratio',
            severity: 'Medium',
            evidence: `Debit/Credit amount ratio: ${amountRatio.toFixed(2)}, count ratio: ${countRatio.toFixed(2)}`,
            recommendation: 'Analyze spending patterns and reduce discretionary debits.',
            events: []
        };
    }
    return null;
}

function detectInformalBorrowing(transactions, threshold = 10000) {
    const largeTransfers = {};
    transactions.forEach(txn => {
        const amount = Math.abs(txn.amount);
        if (amount >= threshold) {
            const narration = txn.narration || '';
            const key = narration.split('-')[1] || narration;
            if (!largeTransfers[key]) largeTransfers[key] = [];
            largeTransfers[key].push({ txnid: txn.txnid, date: txn.date, amount });
        }
    });
    const frequentTransfers = Object.entries(largeTransfers)
        .filter(([_, txns]) => txns.length >= 3)
        .reduce((acc, [k, v]) => {
            acc[k] = v;
            return acc;
        }, {});
    if (Object.keys(frequentTransfers).length > 0) {
        const evidence = Object.entries(frequentTransfers)
            .reduce((acc, [k, v]) => {
                acc[k] = v.slice(0, 5).map(t => t.txnid);
                return acc;
            }, {});
        const events = Object.values(frequentTransfers).flat();
        return {
            signal: 'Potential Informal Borrowing or Lending',
            severity: 'Medium',
            evidence: `Frequent large transfers (>=₹${threshold}) to: ${JSON.stringify(evidence)}`,
            recommendation: 'Investigate relationships with frequent transferees.',
            events
        };
    }
    return null;
}

function detectLimitedLoanRepayment(transactions, summaryInfo, threshold = 0.1) {
    const loanDisbursals = summaryInfo.total.totalLoanDisbursal || 0;
    const emiIssues = summaryInfo.total.totalEmiEcsLoanIssue || 0;
    if (loanDisbursals === 0) return null;
    const repaymentRatio = emiIssues / loanDisbursals;
    if (repaymentRatio < threshold) {
        return {
            signal: 'Limited Loan Repayment Activity',
            severity: 'Medium',
            evidence: `Loan disbursals: ₹${loanDisbursals}, EMI issues: ₹${emiIssues}, ratio: ${repaymentRatio.toFixed(4)}`,
            recommendation: 'Verify loan repayment status and monitor EMIs.',
            events: []
        };
    }
    return null;
}

function detectBalanceVolatility(transactions, threshold = 0.5) {
    const balances = transactions.map(txn => txn.balance);
    if (balances.length < 2) return null;
    const meanBalance = balances.reduce((sum, val) => sum + val, 0) / balances.length;
    if (meanBalance === 0) return null;
    const variance = balances.reduce((sum, val) => sum + Math.pow(val - meanBalance, 2), 0) / balances.length;
    const stdBalance = Math.sqrt(variance);
    const volatility = stdBalance / meanBalance;
    if (volatility > threshold) {
        return {
            signal: 'High Volatility in Account Balance',
            severity: 'Medium',
            evidence: `Balance volatility (std/mean): ${volatility.toFixed(2)}, mean: ₹${meanBalance.toFixed(2)}`,
            recommendation: 'Educate customer on maintaining stable balances.',
            events: []
        };
    }
    return null;
}

function detectSporadicLargeCredits(transactions, threshold = 50000) {
    const validTransactions = transactions.filter(txn => isValidDateString(txn.date));
    const largeCredits = validTransactions
        .filter(txn => txn.amount >= threshold && txn.category !== 'salary')
        .map(txn => ({ txnid: txn.txnid, date: txn.date, amount: txn.amount }));
    const monthlyCredits = {};
    largeCredits.forEach(txn => {
        const month = txn.date.substring(0, 7);
        if (!monthlyCredits[month]) monthlyCredits[month] = [];
        monthlyCredits[month].push(txn);
    });
    const sporadicMonths = Object.keys(monthlyCredits).filter(month => monthlyCredits[month].length <= 2);
    if (sporadicMonths.length > 0) {
        const evidence = sporadicMonths.reduce((acc, month) => {
            acc[month] = monthlyCredits[month].slice(0, 2).map(t => t.txnid);
            return acc;
        }, {});
        return {
            signal: 'Sporadic Large Credits',
            severity: 'Medium',
            evidence: `Large credits (>=₹${threshold}) in months: ${JSON.stringify(evidence)}`,
            recommendation: 'Investigate source of large credits.',
            events: largeCredits
        };
    }
    return null;
}

function detectIrregularEMIPayments(emis, analysisPeriod, threshold = 35) {
    const filtered = filterTransactions(emis, analysisPeriod);
    const gaps = calculatePaymentGaps(filtered);
    const avgGap = gaps.length > 0 ? gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length : 0;
    if (avgGap > threshold) {
        return {
            signal: 'Irregular EMI Payments',
            severity: 'High',
            evidence: `Average EMI payment gap: ${avgGap.toFixed(1)} days, exceeds threshold of ${threshold} days`,
            recommendation: 'Engage customer to ensure timely EMI payments.',
            events: gaps.map(g => ({ gap: g.gap, from: g.from, to: g.to }))
        };
    }
    return null;
}

function detectInsufficientEMIPayments(emis, analysisPeriod, latestBalance, threshold = 0.1) {
    const filtered = filterTransactions(emis, analysisPeriod);
    const totalEMI = filtered.reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
    if (latestBalance === null || latestBalance <= 0) return null;
    const emiRatio = totalEMI / latestBalance;
    if (emiRatio < threshold) {
        return {
            signal: 'Insufficient EMI Payments',
            severity: 'High',
            evidence: `Total EMI: ₹${totalEMI.toFixed(2)}, Latest Balance: ₹${latestBalance.toFixed(2)}, Ratio: ${emiRatio.toFixed(4)} (threshold: ${threshold})`,
            recommendation: 'Assess repayment capacity and adjust EMI schedule if needed.',
            events: filtered.map(txn => ({ txnid: txn.txnid, date: txn.date, amount: txn.amount }))
        };
    }
    return null;
}

async function applyEWS() {
    console.log('Apply EWS button clicked');
    const spinner = document.getElementById('loading-spinner');
    if (!spinner) {
        console.error('Loading spinner not found!');
        return;
    }
    spinner.classList.remove('hidden');

    const selectGroup = document.getElementById('select-group');
    if (!selectGroup) {
        console.error('Select group dropdown not found!');
        spinner.classList.add('hidden');
        return;
    }
    selectedGroup = selectGroup.value;
    console.log('Selected group:', selectedGroup);

    if (!selectedGroup) {
        alert('Please select a user group.');
        spinner.classList.add('hidden');
        return;
    }

    selectedEWS = [];
    const ewsCheckboxes = document.querySelectorAll('#ews-checkboxes .ews-checkbox:checked');
    ewsCheckboxes.forEach(checkbox => {
        selectedEWS.push(checkbox.value);
    });
    console.log('Selected EWS:', selectedEWS);

    if (selectedEWS.length === 0) {
        alert('Please select at least one Early Warning Signal to apply.');
        spinner.classList.add('hidden');
        return;
    }

    const mobileNumbers = await fetchMobileNumbers();
    if (mobileNumbers.length === 0) {
        displayWarnings([], true);
        spinner.classList.add('hidden');
        return;
    }

    const warnings = [];
    const currentDate = new Date('2025-05-06');
    const analysisPeriod = getAnalysisPeriod(currentDate.toISOString().split('T')[0]);
    console.log('Analysis period:', analysisPeriod);

    let processedCustomers = 0;
    for (const mobile of mobileNumbers) {
        const data = await fetchCustomerData(selectedGroup, mobile);
        if (!data) continue;

        processedCustomers++;
        const accountXns = data.accountXns?.[0]?.xns || [];
        const salaryXns = data.salaryXns || [];
        const emis = data.eMIECSLOANXns || [];
        const eODBalances = data.eODBalances || [];

        // Compute latest balance
        let latestBalance = null;
        if (eODBalances.length > 0) {
            const validEODs = eODBalances.filter(eod => isValidDateString(eod.date));
            if (validEODs.length > 0) {
                validEODs.sort((a, b) => new Date(b.date) - new Date(a.date));
                latestBalance = validEODs[0].balance;
            }
        }

        // Find the latest month
        const latestMonth = getLatestMonth(accountXns);

        // Filter to strict 6-month period
        const filteredXns = filter6Months(accountXns, latestMonth);
        const filteredSalaryXns = filter6Months(salaryXns, latestMonth);
        const summaryInfo = calculateSummaryInfo(filteredXns);

        // Define EWS detectors
        const detectors = {
            'low_balances': () => detectLowBalances(filteredXns),
            'high_transaction_volume': () => detectHighTransactionVolume(filteredXns),
            'post_salary_transfers': () => detectPostSalaryTransfers(filteredXns, filteredSalaryXns),
            'below_min_balance': () => detectBelowMinBalance(filteredXns),
            'inconsistent_salary': () => detectInconsistentSalary(filteredSalaryXns),
            'debit_credit_ratio': () => detectDebitCreditRatio(summaryInfo),
            'informal_borrowing': () => detectInformalBorrowing(filteredXns),
            'limited_loan_repayment': () => detectLimitedLoanRepayment(filteredXns, summaryInfo),
            'balance_volatility': () => detectBalanceVolatility(filteredXns),
            'sporadic_large_credits': () => detectSporadicLargeCredits(filteredXns),
            'irregular_emi_payments': () => detectIrregularEMIPayments(emis, analysisPeriod),
            'insufficient_emi_payments': () => detectInsufficientEMIPayments(emis, analysisPeriod, latestBalance)
        };

        // Apply selected EWS
        selectedEWS.forEach(ewsName => {
            const detector = detectors[ewsName];
            if (!detector) {
                console.warn(`No detector found for EWS: ${ewsName}`);
                return;
            }

            const result = detector();
            if (result) {
                warnings.push({
                    mobile,
                    group: selectedGroup,
                    type: result.signal,
                    details: result.evidence,
                    severity: result.severity,
                    date: formatDate(currentDate)
                });
            }
        });
    }

    console.log('Processed customers:', processedCustomers);
    console.log('Warnings generated:', warnings);
    allWarnings = warnings;
    displayWarnings(warnings, processedCustomers === 0);
    setupFilters(warnings);
    spinner.classList.add('hidden');
}

function displayWarnings(warnings, noDataFetched = false) {
    console.log('Displaying warnings...');
    const tbody = document.getElementById('ews-table-body');
    if (!tbody) {
        console.error('EWS table body not found!');
        return;
    }
    tbody.innerHTML = '';

    if (noDataFetched) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" class="py-3 px-4 text-center text-red-500">Failed to fetch customer data. Please ensure the data files (e.g., assets/mobile_numbers.json, assets/user_groups_data/${selectedGroup}/[mobile]_cleaned.json) are available and accessible.</td>`;
        tbody.appendChild(row);
        return;
    }

    if (warnings.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="6" class="py-3 px-4 text-center">No warnings found for the selected group and signals.</td>`;
        tbody.appendChild(row);
        return;
    }

    warnings.forEach(warning => {
        const row = document.createElement('tr');
        row.className = warning.severity === 'High' ? 'list-group-item-warning' : '';
        row.innerHTML = `
            <td class="py-3 px-4">${warning.mobile}</td>
            <td class="py-3 px-4">${warning.group}</td>
            <td class="py-3 px-4">${warning.type}</td>
            <td class="py-3 px-4">${warning.details}</td>
            <td class="py-3 px-4">${warning.severity}</td>
            <td class="py-3 px-4">${warning.date}</td>
        `;
        tbody.appendChild(row);
    });
}

function setupFilters(warnings) {
    console.log('Setting up filters...');
    const severityFilter = document.getElementById('severity-filter');
    const groupFilter = document.getElementById('group-filter');

    if (!severityFilter || !groupFilter) {
        console.error('Severity or group filter not found!');
        return;
    }

    function filterWarnings() {
        let filteredWarnings = [...allWarnings];
        const severity = severityFilter.value;
        const group = groupFilter.value;

        if (severity !== 'all') {
            filteredWarnings = filteredWarnings.filter(warning => warning.severity === severity);
        }

        if (group !== 'all') {
            filteredWarnings = filteredWarnings.filter(warning => warning.group === group);
        }

        displayWarnings(filteredWarnings);
    }

    severityFilter.addEventListener('change', filterWarnings);
    groupFilter.addEventListener('change', filterWarnings);

    filterWarnings();
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing EWS...');
    populateEWSCheckboxes();

    const applyButton = document.getElementById('apply-ews');
    if (!applyButton) {
        console.error('Apply EWS button not found!');
        return;
    }
    applyButton.addEventListener('click', () => {
        console.log('Apply EWS button clicked (event listener)');
        applyEWS();
    });
});