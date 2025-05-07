async function fetchMobileNumbers() {
    try {
        const response = await fetch('assets/mobile_numbers.json');
        if (!response.ok) throw new Error('Failed to fetch mobile numbers');
        return (await response.json()).mobileNumbers;
    } catch (e) {
        console.error('Error fetching mobile numbers:', e);
        return [];
    }
}

async function fetchCustomerData(group, mobile) {
    try {
        const response = await fetch(`assets/user_groups_data/${group}/${mobile}_cleaned.json`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error(`Error fetching data for ${mobile} in group ${group}:`, e);
        return null;
    }
}

function calculateDaysPastDue(txnDate, currentDate) {
    const dueDate = new Date(txnDate);
    const diffTime = currentDate - dueDate;
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

function getMonthlyRepayments(transactions, analysisPeriod) {
    const monthlyRepayments = {};
    analysisPeriod.forEach(month => monthlyRepayments[month] = 0);

    transactions.forEach(txn => {
        const txnDate = new Date(txn.date);
        const monthKey = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`;
        if (txn.category === 'loan_repayment' && analysisPeriod.includes(monthKey)) {
            monthlyRepayments[monthKey] += Math.abs(txn.amount);
        }
    });

    return analysisPeriod.map(month => monthlyRepayments[month]);
}

function getMonthlyAverageBalance(transactions, analysisPeriod) {
    const monthlyBalances = {};
    analysisPeriod.forEach(month => monthlyBalances[month] = { total: 0, count: 0 });

    transactions.forEach(txn => {
        const txnDate = new Date(txn.date);
        const monthKey = `${txnDate.getFullYear()}-${String(txnDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthKey in monthlyBalances) {
            monthlyBalances[monthKey].total += parseFloat(txn.balance || 0);
            monthlyBalances[monthKey].count += 1;
        }
    });

    return analysisPeriod.map(month => {
        const data = monthlyBalances[month];
        return data.count > 0 ? data.total / data.count : 0;
    });
}

async function loadDashboard() {
    const groups = ['0-30', '31-60', '61-90', 'net_npa'];
    const mobileNumbers = await fetchMobileNumbers();
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let totalDPD = 0;
    let overdueCount = 0;
    let totalRepaymentsExpected = 0;
    let totalRepaymentsReceived = 0;
    const groupData = {
        '0-30': { outstanding: 0, count: 0 },
        '31-60': { outstanding: 0, count: 0 },
        '61-90': { outstanding: 0, count: 0 },
        'net_npa': { outstanding: 0, count: 0 }
    };
    const customerData = [];
    const currentDate = new Date('2025-05-06');

    const latestDate = new Date();
    const analysisPeriod = [];
    for (let i = 0; i < 6; i++) {
        const date = new Date(latestDate.getFullYear(), latestDate.getMonth() - i, 1);
        analysisPeriod.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }

    const allTransactions = [];
    for (const group of groups) {
        for (const mobile of mobileNumbers) {
            const data = await fetchCustomerData(group, mobile);
            if (!data) continue;

            groupData[group].count += 1;
            const accounts = data.accountXns || [];
            const allXns = accounts.flatMap(acct => acct.xns || []);
            if (allXns.length === 0) continue;

            allTransactions.push(...allXns);

            const latestTxn = allXns.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const outstandingBalance = parseFloat(latestTxn.balance || 0);
            totalOutstanding += outstandingBalance;
            groupData[group].outstanding += outstandingBalance;

            const emis = allXns.filter(txn => txn.category === 'loan_repayment');
            emis.forEach(txn => {
                const dpd = calculateDaysPastDue(txn.date, currentDate);
                if (dpd > 0) {
                    totalOverdue += outstandingBalance;
                    totalDPD += dpd;
                    overdueCount += 1;
                }
            });

            const expectedRepayments = emis.length * 5000;
            totalRepaymentsExpected += expectedRepayments;
            const receivedRepayments = emis.reduce((sum, txn) => sum + Math.abs(txn.amount), 0);
            totalRepaymentsReceived += receivedRepayments;

            customerData.push({
                mobile,
                group,
                outstanding: outstandingBalance,
                dpd: emis.length > 0 ? calculateDaysPastDue(emis[0].date, currentDate) : 0
            });
        }
    }

    document.getElementById('total-outstanding').innerText = `₹${totalOutstanding.toFixed(2)}`;
    document.getElementById('total-overdue').innerText = `₹${totalOverdue.toFixed(2)}`;
    const avgDPD = overdueCount > 0 ? totalDPD / overdueCount : 0;
    document.getElementById('avg-dpd').innerText = `${avgDPD.toFixed(1)} days`;
    const collectionEfficiency = totalRepaymentsExpected > 0 ? (totalRepaymentsReceived / totalRepaymentsExpected) * 100 : 0;
    document.getElementById('collection-efficiency').innerText = `${collectionEfficiency.toFixed(2)}%`;

    document.getElementById('group-0-30-outstanding').innerText = `Outstanding: ₹${groupData['0-30'].outstanding.toFixed(2)}`;
    document.getElementById('group-0-30-count').innerText = `Customers: ${groupData['0-30'].count}`;
    document.getElementById('group-31-60-outstanding').innerText = `Outstanding: ₹${groupData['31-60'].outstanding.toFixed(2)}`;
    document.getElementById('group-31-60-count').innerText = `Customers: ${groupData['31-60'].count}`;
    document.getElementById('group-61-90-outstanding').innerText = `Outstanding: ₹${groupData['61-90'].outstanding.toFixed(2)}`;
    document.getElementById('group-61-90-count').innerText = `Customers: ${groupData['61-90'].count}`;
    document.getElementById('group-net-npa-outstanding').innerText = `Outstanding: ₹${groupData['net_npa'].outstanding.toFixed(2)}`;
    document.getElementById('group-net-npa-count').innerText = `Customers: ${groupData['net_npa'].count}`;

    const monthlyRepayments = getMonthlyRepayments(allTransactions, analysisPeriod);
    const repaymentCtx = document.getElementById('repayment-trend-chart').getContext('2d');
    new Chart(repaymentCtx, {
        type: 'line',
        data: {
            labels: analysisPeriod.map(month => month),
            datasets: [{
                label: 'Repayments (₹)',
                data: monthlyRepayments,
                borderColor: '#FF6200',
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Amount (₹)' } },
                x: { title: { display: true, text: 'Month' } }
            }
        }
    });

    const monthlyBalances = getMonthlyAverageBalance(allTransactions, analysisPeriod);
    const balanceCtx = document.getElementById('balance-trend-chart').getContext('2d');
    new Chart(balanceCtx, {
        type: 'line',
        data: {
            labels: analysisPeriod.map(month => month),
            datasets: [{
                label: 'Average Balance',
                data: monthlyBalances,
                borderColor: '#FF6200',
                fill: false
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'Balance (₹)' } },
                x: { title: { display: true, text: 'Month' } }
            }
        }
    });

    const topDefaulters = customerData
        .filter(customer => customer.dpd > 0)
        .sort((a, b) => b.outstanding - a.outstanding)
        .slice(0, 5);
    const topDefaultersList = document.getElementById('top-defaulters');
    topDefaulters.forEach(customer => {
        const li = document.createElement('li');
        li.className = 'list-group-item';
        li.innerText = `Mobile: ${customer.mobile}, Outstanding: ₹${customer.outstanding.toFixed(2)}, DPD: ${customer.dpd} days`;
        topDefaultersList.appendChild(li);
    });

    const highRiskCustomers = customerData.filter(customer => customer.dpd > 30);
    const highRiskList = document.getElementById('high-risk-customers');
    highRiskCustomers.forEach(customer => {
        const li = document.createElement('li');
        li.className = 'list-group-item list-group-item-warning';
        li.innerText = `Mobile: ${customer.mobile}, Group: ${customer.group}, Outstanding: ₹${customer.outstanding.toFixed(2)}, DPD: ${customer.dpd} days`;
        highRiskList.appendChild(li);
    });
}

document.addEventListener('DOMContentLoaded', loadDashboard);