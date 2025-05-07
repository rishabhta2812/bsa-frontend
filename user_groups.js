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

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function loadCustomers() {
    const spinner = document.getElementById('loading-spinner');
    spinner.classList.remove('hidden');

    const groups = ['0-30', '31-60', '61-90', 'net_npa'];
    const mobileNumbers = await fetchMobileNumbers();
    const customerData = [];
    const currentDate = new Date('2025-05-06');

    for (const group of groups) {
        for (const mobile of mobileNumbers) {
            const data = await fetchCustomerData(group, mobile);
            if (!data) continue;

            const accounts = data.accountXns || [];
            const allXns = accounts.flatMap(acct => acct.xns || []);
            if (allXns.length === 0) continue;

            const latestTxn = allXns.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            const outstandingBalance = parseFloat(latestTxn.balance || 0);

            const repayments = allXns.filter(txn => txn.category === 'loan_repayment');
            const lastRepayment = repayments.length > 0 ? repayments[0].date : 'N/A';

            const repaymentHistory = repayments.slice(0, 3).map(txn => ({
                date: formatDate(txn.date),
                amount: Math.abs(txn.amount).toFixed(2)
            }));

            customerData.push({
                mobile,
                group,
                outstanding: outstandingBalance,
                lastRepayment: lastRepayment !== 'N/A' ? formatDate(lastRepayment) : 'N/A',
                repaymentHistory
            });
        }
    }

    displayCustomers(customerData);
    setupFiltersAndSorting(customerData);
    spinner.classList.add('hidden');
}

function displayCustomers(customers) {
    const tbody = document.getElementById('customer-table-body');
    tbody.innerHTML = '';

    customers.forEach(customer => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="py-3 px-4">${customer.mobile}</td>
            <td class="py-3 px-4">${customer.group}</td>
            <td class="py-3 px-4">₹${customer.outstanding.toFixed(2)}</td>
            <td class="py-3 px-4">${customer.lastRepayment}</td>
            <td class="py-3 px-4">
                ${customer.repaymentHistory.length > 0 ? 
                    customer.repaymentHistory.map(r => `${r.date}: ₹${r.amount}`).join('<br>') : 
                    'No repayments'}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function setupFiltersAndSorting(customerData) {
    const groupFilter = document.getElementById('group-filter');
    const sortBy = document.getElementById('sort-by');
    const sortOrderBtn = document.getElementById('sort-order');
    let isAscending = true;

    function filterAndSort() {
        let filteredData = [...customerData];
        const group = groupFilter.value;
        const sortField = sortBy.value;

        if (group !== 'all') {
            filteredData = filteredData.filter(customer => customer.group === group);
        }

        filteredData.sort((a, b) => {
            let comparison = 0;
            if (sortField === 'mobile') {
                comparison = a.mobile.localeCompare(b.mobile);
            } else if (sortField === 'outstanding') {
                comparison = a.outstanding - b.outstanding;
            }
            return isAscending ? comparison : -comparison;
        });

        displayCustomers(filteredData);
    }

    groupFilter.addEventListener('change', filterAndSort);
    sortBy.addEventListener('change', filterAndSort);
    sortOrderBtn.addEventListener('click', () => {
        isAscending = !isAscending;
        sortOrderBtn.innerHTML = `<i class="fas fa-sort mr-2"></i>Sort ${isAscending ? 'Ascending' : 'Descending'}`;
        filterAndSort();
    });

    filterAndSort();
}

document.addEventListener('DOMContentLoaded', loadCustomers);