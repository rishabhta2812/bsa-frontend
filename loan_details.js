let selectedGroup = null;
let selectedCustomer = null;

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
        console.log(`Fetching loan data for ${mobile} in group ${group}...`);
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

function isValidDateString(dateString) {
    if (typeof dateString !== 'string' || !dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
}

function formatDate(dateString) {
    if (!isValidDateString(dateString)) return 'Invalid Date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatAmount(amount) {
    return `₹${Math.abs(amount).toFixed(2)}`;
}

function displayLoanTransactions(transactions) {
    const loanDetailsDiv = document.getElementById('loan-details');
    const tableBody = document.getElementById('loan-table-body');
    if (!loanDetailsDiv || !tableBody) {
        console.error('Loan details elements not found!');
        return;
    }

    tableBody.innerHTML = '';

    if (transactions.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="5" class="py-2 px-3 text-center text-gray-500">No loan repayment transactions found.</td>`;
        tableBody.appendChild(row);
    } else {
        transactions.forEach(txn => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="py-2 px-3">${formatDate(txn.date)}</td>
                <td class="py-2 px-3">${formatAmount(txn.amount)}</td>
                <td class="py-2 px-3">${txn.balance.toFixed(2)}</td>
                <td class="py-2 px-3">${txn.narration || '-'}</td>
                <td class="py-2 px-3">${txn.txnid}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    loanDetailsDiv.classList.remove('hidden');
}

function populateMobileDropdown(mobileNumbers) {
    const selectMobile = document.getElementById('select-mobile');
    if (!selectMobile) {
        console.error('Mobile number dropdown not found!');
        return;
    }

    selectMobile.innerHTML = '<option value="">Select a mobile number</option>';

    if (mobileNumbers.length === 0) {
        selectMobile.disabled = true;
        selectMobile.classList.add('bg-gray-100');
        selectMobile.classList.remove('bg-white');
        return;
    }

    mobileNumbers.forEach(mobile => {
        const option = document.createElement('option');
        option.value = mobile;
        option.textContent = mobile;
        selectMobile.appendChild(option);
    });

    selectMobile.disabled = false;
    selectMobile.classList.remove('bg-gray-100');
    selectMobile.classList.add('bg-white');
}

async function fetchAndDisplayLoanDetails() {
    console.log('Fetch Loan Details button clicked');
    const spinner = document.getElementById('loading-spinner');
    const selectGroup = document.getElementById('select-group');
    const selectMobile = document.getElementById('select-mobile');

    if (!spinner || !selectGroup || !selectMobile) {
        console.error('Required elements not found!');
        return;
    }

    const group = selectGroup.value;
    const mobile = selectMobile.value;

    if (!group) {
        alert('Please select a user group.');
        return;
    }

    if (!mobile) {
        alert('Please select a mobile number.');
        return;
    }

    selectedGroup = group;
    selectedCustomer = { mobile };

    spinner.classList.remove('hidden');

    const data = await fetchCustomerData(group, mobile);
    if (!data) {
        spinner.classList.add('hidden');
        const tableBody = document.getElementById('loan-table-body');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="py-2 px-3 text-center text-red-500">No data found for mobile ${mobile} in group ${group}. Please ensure the data file exists and contains valid JSON.</td></tr>`;
        }
        document.getElementById('loan-details')?.classList.add('hidden');
        document.getElementById('nach-warnings')?.classList.add('hidden');
        return;
    }

    // Display EMI transactions
    const emis = (data.eMIECSLOANXns || []).filter(txn => isValidDateString(txn.date));
    displayLoanTransactions(emis);

    // Hide NACH warnings initially
    document.getElementById('nach-warnings')?.classList.add('hidden');

    spinner.classList.add('hidden');
}

// NACH Analysis Functions
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
        if (!isValidDateString(txn.date)) return false;
        const txnDate = new Date(txn.date);
        const txnMonth = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`;
        return analysisPeriod.includes(txnMonth);
    });
}

function getMonthlySums(transactions) {
    const monthly = {};
    transactions.forEach(txn => {
        const date = new Date(txn.date);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthly[month] = (monthly[month] || 0) + Math.abs(txn.amount);
    });
    return monthly;
}

function getRepeatingAmounts(transactions) {
    const amounts = transactions.map(txn => Math.round(Math.abs(txn.amount) * 100) / 100);
    const counts = {};
    amounts.forEach(amt => {
        counts[amt] = (counts[amt] || 0) + 1;
    });
    return Object.entries(counts)
        .filter(([_, count]) => count >= 2)
        .reduce((acc, [amt, count]) => {
            acc[parseFloat(amt)] = count;
            return acc;
        }, {});
}

function getAmountPeriods(transactions, repeating) {
    const amountPeriods = {};
    Object.keys(repeating).forEach(amt => {
        const amtFloat = parseFloat(amt);
        const matchingTxns = transactions.filter(txn => Math.round(Math.abs(txn.amount) * 100) / 100 === amtFloat);
        const dates = matchingTxns.map(txn => new Date(txn.date));
        const firstDate = new Date(Math.min(...dates));
        const lastDate = new Date(Math.max(...dates));
        const firstPeriod = `${firstDate.getFullYear()}-${String(firstDate.getMonth() + 1).padStart(2, '0')}`;
        const lastPeriod = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`;
        amountPeriods[amtFloat] = { first: firstPeriod, last: lastPeriod };
    });
    return amountPeriods;
}

function getExpectedAmounts(analysisPeriod, amountPeriods) {
    const expMap = {};
    analysisPeriod.forEach(period => {
        let expected = 0;
        Object.entries(amountPeriods).forEach(([amt, periods]) => {
            if (period >= periods.first && period <= periods.last) {
                expected += parseFloat(amt);
            }
        });
        expMap[period] = expected;
    });
    return expMap;
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

function predictNextDueDate(currentDate, commonDay) {
    let nextDue = new Date(currentDate);
    try {
        nextDue.setDate(commonDay);
        if (nextDue.getDate() < currentDate.getDate()) {
            nextDue.setMonth(nextDue.getMonth() + 1);
        }
    } catch (e) {
        const lastDay = new Date(nextDue.getFullYear(), nextDue.getMonth() + 1, 0).getDate();
        nextDue.setDate(Math.min(commonDay, lastDay));
        if (nextDue.getDate() < currentDate.getDate()) {
            nextDue.setMonth(nextDue.getMonth() + 1);
        }
    }
    return nextDue.toISOString().split('T')[0];
}

function calculateConsistencyScore(gaps, actualVsExpected, analysisPeriod) {
    let score = 100;
    if (gaps.length > 0) {
        const avgGap = gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length;
        if (avgGap > 30) {
            score -= (avgGap - 30) * 2;
        }
    } else {
        score -= 20;
    }
    analysisPeriod.forEach(period => {
        const actual = actualVsExpected.actual[period] || 0;
        const expected = actualVsExpected.expected[period] || 0;
        if (expected > 0) {
            const deviation = Math.abs(actual - expected) / expected;
            if (deviation > 0.1) {
                score -= deviation * 20;
            }
        }
    });
    return Math.max(0, Math.round(score));
}

function analyzePaymentTrend(monthlySums, analysisPeriod) {
    const amounts = analysisPeriod.map(period => monthlySums[period] || 0);
    if (amounts.length < 2) return 'Insufficient data for trend analysis.';
    const diffs = [];
    for (let i = 1; i < amounts.length; i++) {
        if (amounts[i - 1] !== 0) {
            diffs.push((amounts[i] - amounts[i - 1]) / amounts[i - 1]);
        }
    }
    if (diffs.length === 0) return 'No consistent payments for trend analysis.';
    const avgDiff = diffs.reduce((sum, d) => sum + d, 0) / diffs.length;
    if (avgDiff > 0.1) return `Increasing trend in EMI payments (avg increase: ${(avgDiff * 100).toFixed(1)}%).`;
    if (avgDiff < -0.1) return `Decreasing trend in EMI payments (avg decrease: ${(Math.abs(avgDiff) * 100).toFixed(1)}%).`;
    return 'Stable EMI payment trend.';
}

async function executeNACHAction() {
    if (!selectedCustomer) {
        alert('Please select a customer first.');
        return;
    }

    const spinner = document.getElementById('loading-spinner');
    if (!spinner) {
        console.error('Loading spinner not found!');
        return;
    }

    spinner.classList.remove('hidden');

    try {
        const data = await fetchCustomerData(selectedGroup, selectedCustomer.mobile);
        if (!data) {
            alert('Failed to fetch customer data.');
            return;
        }

        const emis = (data.eMIECSLOANXns || []).filter(txn => isValidDateString(txn.date));
        if (emis.length === 0) {
            alert('No EMI payments found for this customer.');
            return;
        }

        const dates = emis.map(txn => new Date(txn.date));
        const latestDate = new Date(Math.max(...dates));
        const analysisPeriod = getAnalysisPeriod(latestDate.toISOString().split('T')[0]);
        const filtered = filterTransactions(emis, analysisPeriod);
        const repeating = getRepeatingAmounts(filtered);

        if (Object.keys(repeating).length === 0) {
            alert('No repeating EMI amounts detected.');
            return;
        }

        const allAccounts = data.accountXns || [];
        let latestBalance = 0;
        if (allAccounts.length > 0) {
            const allXns = allAccounts.flatMap(acct => acct.xns || []).filter(txn => isValidDateString(txn.date));
            if (allXns.length > 0) {
                const latestTxn = allXns.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                latestBalance = parseFloat(latestTxn.balance || 0);
            }
        }

        const nextEMIs = [];
        Object.entries(repeating).forEach(([amt, count]) => {
            const amtFloat = parseFloat(amt);
            const matchingTxns = filtered.filter(txn => Math.round(Math.abs(txn.amount) * 100) / 100 === amtFloat);
            const days = matchingTxns.map(txn => new Date(txn.date).getDate());
            const commonDay = days.sort((a, b) => days.filter(v => v === a).length - days.filter(v => v === b).length).pop();
            const lastPaymentDate = new Date(Math.max(...matchingTxns.map(txn => new Date(txn.date))));
            const predictedDue = predictNextDueDate(lastPaymentDate, commonDay);
            nextEMIs.push({ amount: amtFloat, dueDate: predictedDue });
        });

        const totalEMIAmount = nextEMIs.reduce((sum, emi) => sum + emi.amount, 0);
        const isBalanceSufficient = latestBalance >= totalEMIAmount;

        if (isBalanceSufficient) {
            alert(`NACH has been executed successfully for EMI(s) totaling ${formatAmount(totalEMIAmount)} due on ${nextEMIs.map(emi => emi.dueDate).join(', ')}.`);
        } else {
            alert(`Insufficient balance (${formatAmount(latestBalance)}) for EMI(s) totaling ${formatAmount(totalEMIAmount)}. NACH will be executed once the balance is updated.`);
        }
    } catch (e) {
        console.error('Error executing NACH action:', e);
        alert(`Error executing NACH action: ${e.message}`);
    } finally {
        spinner.classList.add('hidden');
    }
}

async function showNACHWarnings() {
    if (!selectedCustomer) {
        alert('Please select a customer first.');
        return;
    }

    const spinner = document.getElementById('loading-spinner');
    const nachWarningsDiv = document.getElementById('nach-warnings');
    const nachResultsDiv = document.getElementById('nach-results');
    if (!spinner || !nachWarningsDiv || !nachResultsDiv) {
        console.error('NACH analysis elements not found!');
        return;
    }

    spinner.classList.remove('hidden');
    nachWarningsDiv.classList.remove('hidden');
    nachResultsDiv.innerHTML = '<p class="text-gray-500">Analyzing NACH EMI data...</p>';

    try {
        const data = await fetchCustomerData(selectedGroup, selectedCustomer.mobile);
        if (!data) throw new Error('Failed to fetch customer data');

        const emis = (data.eMIECSLOANXns || []).filter(txn => isValidDateString(txn.date));
        const alerts = [];

        if (emis.length === 0) {
            alerts.push({ type: 'warning', message: 'No EMI payments found.', icon: '⚠️' });
        } else {
            const dates = emis.map(txn => new Date(txn.date));
            const simulatedCurrentDate = new Date(Math.max(...dates));
            const analysisPeriod = getAnalysisPeriod(simulatedCurrentDate.toISOString().split('T')[0]);
            alerts.push({ type: 'info', message: `Analysis Period (6 months): ${analysisPeriod.join(', ')}`, icon: 'ℹ️' });

            const filtered = filterTransactions(emis, analysisPeriod);
            const count = filtered.length;
            const totalAmt = filtered.reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
            if (count === 0) {
                alerts.push({ type: 'warning', message: 'No EMI payments found in the last 6 months.', icon: '⚠️' });
            } else {
                alerts.push({ type: 'info', message: `${count} EMI transaction(s) found in the last 6 months.`, icon: 'ℹ️' });
                alerts.push({ type: 'info', message: `Total EMI amount paid in the last 6 months: ${formatAmount(totalAmt)}`, icon: 'ℹ️' });
            }

            const repeating = getRepeatingAmounts(filtered);
            const amountPeriods = getAmountPeriods(filtered, repeating);
            const monthly = getMonthlySums(filtered);
            const expMap = getExpectedAmounts(analysisPeriod, amountPeriods);
            const actualVsExpected = { actual: monthly, expected: expMap };

            // Display next EMI and balance information
            if (Object.keys(repeating).length > 0) {
                const allAccounts = data.accountXns || [];
                let latestBalance = 0;
                if (allAccounts.length > 0) {
                    const allXns = allAccounts.flatMap(acct => acct.xns || []).filter(txn => isValidDateString(txn.date));
                    if (allXns.length > 0) {
                        const latestTxn = allXns.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                        latestBalance = parseFloat(latestTxn.balance || 0);
                    }
                }

                Object.entries(repeating).forEach(([amt, count]) => {
                    const amtFloat = parseFloat(amt);
                    const matchingTxns = filtered.filter(txn => Math.round(Math.abs(txn.amount) * 100) / 100 === amtFloat);
                    const days = matchingTxns.map(txn => new Date(txn.date).getDate());
                    const commonDay = days.sort((a, b) => days.filter(v => v === a).length - days.filter(v => v === b).length).pop();
                    const lastPaymentDate = new Date(Math.max(...matchingTxns.map(txn => new Date(txn.date))));
                    const predictedDue = predictNextDueDate(lastPaymentDate, commonDay);
                    alerts.push({ type: 'info', message: `Next EMI of ${formatAmount(amtFloat)} is due on ${predictedDue}.`, icon: '📅' });
                    if (latestBalance >= amtFloat) {
                        alerts.push({ type: 'info', message: `Balance (${formatAmount(latestBalance)}) is sufficient for EMI ${formatAmount(amtFloat)}.`, icon: '✅' });
                    } else {
                        alerts.push({ type: 'warning', message: `Balance (${formatAmount(latestBalance)}) is insufficient for EMI ${formatAmount(amtFloat)}.`, icon: '⚠️' });
                    }
                });
            }

            analysisPeriod.forEach(period => {
                const actual = monthly[period] || 0;
                const expected = expMap[period] || 0;
                if (expected === 0) {
                    alerts.push({ type: 'notice', message: `No repeating EMI amounts expected in ${period}.`, icon: '📌' });
                } else if (actual < 0.9 * expected) {
                    alerts.push({ type: 'alert', message: `Underpayment in ${period}. Actual: ${formatAmount(actual)}, Expected: ${formatAmount(expected)}`, icon: '🚨' });
                } else if (actual > 1.1 * expected) {
                    alerts.push({ type: 'warning', message: `Overpayment in ${period}. Actual: ${formatAmount(actual)}, Expected: ${formatAmount(expected)}`, icon: '⚠️' });
                } else {
                    alerts.push({ type: 'info', message: `${period} payments are on track. Actual: ${formatAmount(actual)}, Expected: ${formatAmount(expected)}`, icon: '✅' });
                }
            });

            const gaps = calculatePaymentGaps(filtered);
            gaps.forEach(gap => {
                if (gap.gap > 40) {
                    alerts.push({ type: 'alert', message: `Payment gap of ${gap.gap} days between ${gap.from} and ${gap.to}.`, icon: '🚨' });
                }
            });
            if (gaps.length > 0) {
                const avgGap = gaps.reduce((sum, g) => sum + g.gap, 0) / gaps.length;
                alerts.push({ type: 'info', message: `Average payment gap: ${avgGap.toFixed(1)} days.`, icon: 'ℹ️' });
            }

            const consistencyScore = calculateConsistencyScore(gaps, actualVsExpected, analysisPeriod);
            const scoreMessage = consistencyScore >= 80 ? 'Good' : consistencyScore >= 50 ? 'Fair' : 'Poor';
            alerts.push({ type: 'info', message: `EMI Payment Consistency Score: ${consistencyScore}/100 (${scoreMessage}).`, icon: '📊' });

            const trend = analyzePaymentTrend(monthly, analysisPeriod);
            alerts.push({ type: 'info', message: `Payment Trend: ${trend}`, icon: '📈' });

            const dom = simulatedCurrentDate.getDate();
            let nextDue = new Date(simulatedCurrentDate);
            try {
                nextDue.setMonth(nextDue.getMonth() + 1);
                nextDue.setDate(dom);
            } catch (e) {
                const lastDay = new Date(nextDue.getFullYear(), nextDue.getMonth() + 1, 0).getDate();
                nextDue.setDate(lastDay);
            }
            const delta = Math.round((nextDue - simulatedCurrentDate) / (1000 * 60 * 60 * 24));
            if (delta > 0 && delta <= 5) {
                alerts.push({ type: 'reminder', message: `Next EMI is due in ${delta} day(s) on ${nextDue.toISOString().split('T')[0]}.`, icon: '⏰' });
            } else if (delta <= 0) {
                alerts.push({ type: 'notice', message: `Next EMI due date (${nextDue.toISOString().split('T')[0]}) is now or past.`, icon: '📌' });
            }

            if (filtered.length > 0) {
                if (Object.keys(repeating).length === 0) {
                    alerts.push({ type: 'warning', message: 'No EMI amount repeated more than once.', icon: '⚠️' });
                } else if (Object.keys(repeating).length === 1) {
                    const [amt, count] = Object.entries(repeating)[0];
                    const amtFloat = parseFloat(amt);
                    const matchingTxns = filtered.filter(txn => Math.round(Math.abs(txn.amount) * 100) / 100 === amtFloat);
                    const days = matchingTxns.map(txn => new Date(txn.date).getDate());
                    const commonDay = days.sort((a, b) => days.filter(v => v === a).length - days.filter(v => v === b).length).pop();
                    alerts.push({ type: 'info', message: `Regular EMI pattern detected: Amount ${formatAmount(amtFloat)} in ${count} months, due on day ${commonDay}.`, icon: '✅' });

                    matchingTxns.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(txn => {
                        const txnDate = new Date(txn.date);
                        const txnDay = txnDate.getDate();
                        const diff = txnDay - commonDay;
                        const status = diff === 0 ? 'on time' : `${Math.abs(diff)} day(s) ${diff > 0 ? 'late' : 'early'}`;
                        alerts.push({ type: 'info', message: `Payment on ${txn.date} for ${formatAmount(txn.amount)} (Narration: ${txn.narration || 'N/A'}) is ${status}.`, icon: 'ℹ️' });
                    });

                    const paidMonths = new Set(matchingTxns.map(txn => txn.date.substring(0, 7)));
                    const firstPeriod = amountPeriods[amtFloat].first;
                    const checkPeriods = analysisPeriod.filter(p => p >= firstPeriod);
                    checkPeriods.forEach(period => {
                        if (!paidMonths.has(period)) {
                            alerts.push({ type: 'alert', message: `No payment for EMI amount ${formatAmount(amtFloat)} in ${period}.`, icon: '🚨' });
                        }
                    });

                    const lastPaymentDate = new Date(Math.max(...matchingTxns.map(txn => new Date(txn.date))));
                    const predictedDue = predictNextDueDate(lastPaymentDate, commonDay);
                    alerts.push({ type: 'info', message: `Next expected EMI payment for ${formatAmount(amtFloat)} is predicted on ${predictedDue}.`, icon: '📅' });
                } else {
                    alerts.push({ type: 'info', message: 'Multiple EMI patterns detected:', icon: 'ℹ️' });
                    Object.entries(repeating).sort((a, b) => a[0] - b[0]).forEach(([amt, count]) => {
                        const amtFloat = parseFloat(amt);
                        const matchingTxns = filtered.filter(txn => Math.round(Math.abs(txn.amount) * 100) / 100 === amtFloat);
                        const days = matchingTxns.map(txn => new Date(txn.date).getDate());
                        const commonDay = days.sort((a, b) => days.filter(v => v === a).length - days.filter(v => v === b).length).pop();
                        const months = [...new Set(matchingTxns.map(txn => txn.date.substring(0, 7)))].sort();
                        alerts.push({ type: 'info', message: `Amount ${formatAmount(amtFloat)} repeated in ${count} months, due on day ${commonDay}:`, icon: '✅' });

                        matchingTxns.sort((a, b) => new Date(a.date) - new Date(b.date)).forEach(txn => {
                            const txnDate = new Date(txn.date);
                            const txnDay = txnDate.getDate();
                            const diff = txnDay - commonDay;
                            const status = diff === 0 ? 'on time' : `${Math.abs(diff)} day(s) ${diff > 0 ? 'late' : 'early'}`;
                            const monthYear = txn.date.substring(0, 7);
                            alerts.push({ type: 'info', message: `- ${monthYear} (${txn.date}): Narration: ${txn.narration || 'N/A'}, ${status}`, icon: 'ℹ️' });
                        });

                        const paidMonths = new Set(matchingTxns.map(txn => txn.date.substring(0, 7)));
                        const firstPeriod = amountPeriods[amtFloat].first;
                        const checkPeriods = analysisPeriod.filter(p => p >= firstPeriod);
                        checkPeriods.forEach(period => {
                            if (!paidMonths.has(period)) {
                                alerts.push({ type: 'alert', message: `No payment for EMI amount ${formatAmount(amtFloat)} in ${period}.`, icon: '🚨' });
                            }
                        });

                        const lastPaymentDate = new Date(Math.max(...matchingTxns.map(txn => new Date(txn.date))));
                        const predictedDue = predictNextDueDate(lastPaymentDate, commonDay);
                        alerts.push({ type: 'info', message: `Next expected EMI payment for ${formatAmount(amtFloat)} is predicted on ${predictedDue}.`, icon: '📅' });
                    });
                }
            } else {
                alerts.push({ type: 'warning', message: 'Unable to determine regular EMI pattern.', icon: '⚠️' });
            }

            const allAccounts = data.accountXns || [];
            if (allAccounts.length > 0) {
                const allXns = allAccounts.flatMap(acct => acct.xns || []).filter(txn => isValidDateString(txn.date));
                if (allXns.length > 0) {
                    const latestTxn = allXns.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                    const latestBalance = parseFloat(latestTxn.balance || 0);
                    const totalEMI = Object.keys(repeating).reduce((sum, amt) => sum + parseFloat(amt), 0);

                    Object.keys(repeating).forEach(amt => {
                        const amtFloat = parseFloat(amt);
                        if (latestBalance >= amtFloat) {
                            alerts.push({ type: 'info', message: `Latest balance (${formatAmount(latestBalance)}) is sufficient for EMI ${formatAmount(amtFloat)}.`, icon: '✅' });
                        } else {
                            alerts.push({ type: 'warning', message: `Latest balance (${formatAmount(latestBalance)}) is not enough for EMI ${formatAmount(amtFloat)}.`, icon: '⚠️' });
                        }
                    });

                    if (latestBalance >= totalEMI) {
                        alerts.push({ type: 'info', message: `Latest balance (${formatAmount(latestBalance)}) is sufficient for total EMIs (${formatAmount(totalEMI)}).`, icon: '✅' });
                    } else {
                        alerts.push({ type: 'warning', message: `Latest balance (${formatAmount(latestBalance)}) is not enough for total EMIs (${formatAmount(totalEMI)}).`, icon: '⚠️' });
                    }
                } else {
                    alerts.push({ type: 'notice', message: 'No transactions found inside accountXns to check the latest balance.', icon: '📌' });
                }
            } else {
                alerts.push({ type: 'notice', message: 'No accountXns data found to check the latest balance.', icon: '📌' });
            }
        }

        nachResultsDiv.innerHTML = '';
        alerts.forEach(alert => {
            const p = document.createElement('p');
            p.className = {
                info: 'text-blue-600',
                warning: 'text-yellow-600',
                alert: 'text-red-600',
                notice: 'text-gray-600',
                reminder: 'text-purple-600'
            }[alert.type] || 'text-gray-800';
            p.innerHTML = `<span class="mr-2">${alert.icon}</span>${alert.message}`;
            nachResultsDiv.appendChild(p);
        });
        console.log(`NACH analysis displayed for ${selectedCustomer.mobile}`);
    } catch (e) {
        console.error(`Error performing NACH analysis for ${selectedCustomer.mobile}:`, e);
        nachResultsDiv.innerHTML = `<p class="text-red-600"><span class="mr-2">❌</span>Error performing NACH analysis: ${e.message}</p>`;
    } finally {
        spinner.classList.add('hidden');
    }
}

function exportLoanDetails(format) {
    const tableBody = document.getElementById('loan-table-body');
    const rows = tableBody.querySelectorAll('tr');
    const data = [];

    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length === 5) {
            data.push({
                Date: cells[0].innerText,
                Amount: cells[1].innerText,
                Balance: cells[2].innerText,
                Narration: cells[3].innerText,
                TransactionID: cells[4].innerText
            });
        }
    });

    if (format === 'csv') {
        const headers = ['Date', 'Amount', 'Balance', 'Narration', 'TransactionID'];
        const csv = [
            headers.join(','),
            ...data.map(row => `${row.Date},${row.Amount},${row.Balance},"${row.Narration.replace(/"/g, '""')}",${row.TransactionID}`)
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `loan_details_${selectedCustomer.mobile}.csv`;
        link.click();
    } else if (format === 'json') {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `loan_details_${selectedCustomer.mobile}.json`;
        link.click();
    }
}

function exportNACHWarnings(format) {
    const nachResultsDiv = document.getElementById('nach-results');
    const paragraphs = nachResultsDiv.querySelectorAll('p');
    const data = [];

    paragraphs.forEach(p => {
        const type = p.className.includes('text-red-600') ? 'alert' :
                     p.className.includes('text-yellow-600') ? 'warning' :
                     p.className.includes('text-blue-600') ? 'info' :
                     p.className.includes('text-purple-600') ? 'reminder' :
                     p.className.includes('text-gray-600') ? 'notice' : 'info';
        const message = p.innerText;
        data.push({ Type: type, Message: message });
    });

    if (format === 'csv') {
        const headers = ['Type', 'Message'];
        const csv = [
            headers.join(','),
            ...data.map(row => `${row.Type},"${row.Message.replace(/"/g, '""')}"`)
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `nach_warnings_${selectedCustomer.mobile}.csv`;
        link.click();
    } else if (format === 'json') {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `nach_warnings_${selectedCustomer.mobile}.json`;
        link.click();
    }
}

function toggleSection(sectionId, chevronId) {
    const content = document.getElementById(sectionId);
    const chevron = document.getElementById(chevronId);
    if (!content || !chevron) {
        console.error(`Section or chevron not found for ${sectionId}`);
        return;
    }

    const isHidden = content.classList.contains('hidden');
    if (isHidden) {
        content.classList.remove('hidden');
        chevron.parentElement.querySelector('svg').classList.add('rotate-180');
    } else {
        content.classList.add('hidden');
        chevron.parentElement.querySelector('svg').classList.remove('rotate-180');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded, initializing Loan Details...');
    
    const selectGroup = document.getElementById('select-group');
    const selectMobile = document.getElementById('select-mobile');
    const fetchButton = document.getElementById('fetch-loan-details');
    const showNachButton = document.getElementById('show-nach-warnings');
    const nachActionButton = document.getElementById('nach-action');
    const toggleLoanDetailsButton = document.getElementById('toggle-loan-details');
    const toggleNachWarningsButton = document.getElementById('toggle-nach-warnings');

    if (!selectGroup || !selectMobile || !fetchButton || !showNachButton || !nachActionButton || !toggleLoanDetailsButton || !toggleNachWarningsButton) {
        console.error('Required elements not found during initialization!');
        alert('Initialization failed. Please check the page structure.');
        return;
    }

    selectGroup.addEventListener('change', async () => {
        console.log('User group changed to:', selectGroup.value);
        if (!selectGroup.value) {
            populateMobileDropdown([]);
            return;
        }

        const mobileNumbers = await fetchMobileNumbers(selectGroup.value);
        populateMobileDropdown(mobileNumbers);
    });

    fetchButton.addEventListener('click', () => {
        console.log('Fetch Loan Details button clicked (event listener)');
        fetchAndDisplayLoanDetails();
    });

    selectMobile.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            fetchAndDisplayLoanDetails();
        }
    });

    showNachButton.addEventListener('click', () => {
        console.log('Show NACH Warnings button clicked');
        showNACHWarnings();
    });

    nachActionButton.addEventListener('click', () => {
        console.log('NACH Action button clicked');
        executeNACHAction();
    });

    toggleLoanDetailsButton.addEventListener('click', () => {
        toggleSection('loan-details-content', 'loan-details-chevron');
    });

    toggleNachWarningsButton.addEventListener('click', () => {
        toggleSection('nach-warnings-content', 'nach-warnings-chevron');
    });
});