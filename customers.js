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

async function fetchCustomerData(mobile) {
    try {
        const response = await fetch(`assets/customer_data/${mobile}_cleaned.json`);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error(`Error fetching data for ${mobile}:`, e);
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

    const mobileNumbers = await fetchMobileNumbers();
    const customerData = [];

    for (const mobile of mobileNumbers) {
        const data = await fetchCustomerData(mobile);
        if (!data) continue;

        // Extract customer profile
        const customerInfo = data.statementdetails[0]?.customerInfo || {};
        const name = customerInfo.name || 'N/A';
        const email = customerInfo.email || 'N/A';
        const pan = customerInfo.pan || 'N/A';

        // Extract summary info
        const summary = data.summaryInfo || {};
        const avgBalance = summary.average?.balAvg || 0;
        const totalLoanDisbursed = summary.average?.totalLoanDisbursal || 0;
        const totalEmiRepayments = summary.average?.totalEmiEcsLoanIssue || 0;
        const totalSalary = summary.average?.totalSalary || 0;
        const emiBounces = summary.average?.totalInwEMIBounce || 0;

        // Extract last loan repayment date
        const loanRepayments = (data.accountXns || [])
            .flatMap(acct => acct.xns || [])
            .filter(txn => txn.category === 'loan_repayment');
        const lastLoanRepayment = loanRepayments.length > 0
            ? formatDate(loanRepayments.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date)
            : 'N/A';

        // Extract top outgoing transaction
        const topOutgoing = data.top5FundsTransferred?.[0] || {};
        const topOutgoingDetails = topOutgoing.amount
            ? `₹${topOutgoing.amount.toFixed(2)} (${topOutgoing.category})`
            : 'N/A';

        customerData.push({
            name,
            mobile,
            pan,
            avgBalance,
            totalLoanDisbursed,
            totalEmiRepayments,
            lastLoanRepayment,
            totalSalary,
            emiBounces,
            topOutgoing: topOutgoingDetails
        });
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
        row.className = customer.emiBounces > 0 ? 'bg-red-100' : '';
        row.innerHTML = `
            <td class="py-3 px-4">${customer.name}</td>
            <td class="py-3 px-4">${customer.mobile}</td>
            <td class="py-3 px-4">${customer.pan}</td>
            <td class="py-3 px-4">₹${customer.avgBalance.toFixed(2)}</td>
            <td class="py-3 px-4">₹${customer.totalLoanDisbursed.toFixed(2)}</td>
            <td class="py-3 px-4">₹${customer.totalEmiRepayments.toFixed(2)}</td>
            <td class="py-3 px-4">${customer.lastLoanRepayment}</td>
            <td class="py-3 px-4 flex items-center">
                ₹${customer.totalSalary.toFixed(2)}
                ${customer.totalSalary === 0 ? '<i class="fas fa-exclamation-triangle text-yellow-500 ml-2" title="No Salary Credits"></i>' : ''}
            </td>
            <td class="py-3 px-4">${customer.emiBounces}</td>
            <td class="py-3 px-4">${customer.topOutgoing}</td>
        `;
        tbody.appendChild(row);
    });
}

function setupFiltersAndSorting(customerData) {
    const emiBounceFilter = document.getElementById('emi-bounce-filter');
    const salaryFilter = document.getElementById('salary-filter');
    const sortBy = document.getElementById('sort-by');
    const sortOrderBtn = document.getElementById('sort-order');
    let isAscending = true;

    function filterAndSort() {
        let filteredData = [...customerData];
        const emiBounce = emiBounceFilter.value;
        const salary = salaryFilter.value;
        const sortField = sortBy.value;

        // Filter by EMI Bounces
        if (emiBounce === 'none') {
            filteredData = filteredData.filter(customer => customer.emiBounces === 0);
        } else if (emiBounce === 'any') {
            filteredData = filteredData.filter(customer => customer.emiBounces > 0);
        }

        // Filter by Salary Credits
        if (salary === 'above-10k') {
            filteredData = filteredData.filter(customer => customer.totalSalary > 10000);
        } else if (salary === 'below-10k') {
            filteredData = filteredData.filter(customer => customer.totalSalary <= 10000 && customer.totalSalary > 0);
        } else if (salary === 'none') {
            filteredData = filteredData.filter(customer => customer.totalSalary === 0);
        }

        // Sort
        filteredData.sort((a, b) => {
            let comparison = 0;
            if (sortField === 'avgBalance') {
                comparison = a.avgBalance - b.avgBalance;
            } else if (sortField === 'totalLoanDisbursed') {
                comparison = a.totalLoanDisbursed - b.totalLoanDisbursed;
            } else if (sortField === 'totalEmiRepayments') {
                comparison = a.totalEmiRepayments - b.totalEmiRepayments;
            } else if (sortField === 'totalSalary') {
                comparison = a.totalSalary - b.totalSalary;
            }
            return isAscending ? comparison : -comparison;
        });

        displayCustomers(filteredData);
    }

    emiBounceFilter.addEventListener('change', filterAndSort);
    salaryFilter.addEventListener('change', filterAndSort);
    sortBy.addEventListener('change', filterAndSort);
    sortOrderBtn.addEventListener('click', () => {
        isAscending = !isAscending;
        sortOrderBtn.innerHTML = `<i class="fas fa-sort mr-2"></i>Sort ${isAscending ? 'Ascending' : 'Descending'}`;
        filterAndSort();
    });

    filterAndSort();
}

document.addEventListener('DOMContentLoaded', loadCustomers);