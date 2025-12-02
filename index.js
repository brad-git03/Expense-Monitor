// --- Configuration Keys (Updated for Monthly Cycle) ---
const BUDGET_KEY = 'monitorApp_monthly_budget';
const TRANSACTIONS_KEY = 'monitorApp_current_transactions';
const MONTHLY_RECORDS_KEY = 'monitorApp_monthly_history';
const CURRENT_CYCLE_MONTH_KEY = 'monitorApp_current_cycle_month'; // YYYY-MM format

// --- Global State Variables (Updated) ---
let monthlyBudget = 0; // New: Total budget for the current cycle
let currentTransactions = []; // Updated: Stores all income and expenses
let monthlyRecords = []; // Updated: Stores archived monthly summaries
let totalIncome = 0;
let totalExpenses = 0;
let netFlow = 0; // New: totalIncome - totalExpenses
let currentView = 'current';
let currentCycleMonth = new Date().toISOString().substring(0, 7); // YYYY-MM

// --- Category Definitions (New Core Concept) ---
const categories = [
    "Salary", // Note: This category should only be used for Income transactions
    "Investments",
    "Side Hustle",
    "Rent",
    "Groceries",
    "Transportation",
    "Entertainment",
    "Utilities",
    "Subscriptions",
    "Other"
];

// --- DOM Elements ---
const appContainer = document.getElementById('app-container');

// --- Helper Functions (Updated) ---

/**
 * Formats a number as Philippine Peso (PHP) currency.
 */
const formatCurrency = (amount) => {
    const absoluteAmount = Math.abs(amount);
    return new Intl.NumberFormat('fil-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2
    }).format(absoluteAmount);
};

/**
 * Generates a simple unique ID for local storage transactions.
 */
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

/**
 * Loads data from localStorage. (Updated for new structure)
 */
const loadData = () => {
    monthlyBudget = parseFloat(localStorage.getItem(BUDGET_KEY) || 0);
    currentCycleMonth = localStorage.getItem(CURRENT_CYCLE_MONTH_KEY) || new Date().toISOString().substring(0, 7);

    const loadArray = (key) => {
        try {
            const rawData = JSON.parse(localStorage.getItem(key) || '[]');
            return rawData.map(t => ({
                ...t,
                amount: parseFloat(t.amount),
                // Ensure all core fields exist
                type: t.type || 'expense', 
                category: t.category || 'Other',
                date: t.date || new Date().toISOString().split('T')[0],
                createdAt: t.createdAt || new Date().toISOString()
            }));
        } catch (e) {
            console.error(`Error loading data for key ${key}:`, e);
            return [];
        }
    };

    currentTransactions = loadArray(TRANSACTIONS_KEY);
    monthlyRecords = loadArray(MONTHLY_RECORDS_KEY);
};

/**
 * Saves all current state data to localStorage.
 */
const saveData = () => {
    localStorage.setItem(BUDGET_KEY, monthlyBudget.toString());
    localStorage.setItem(CURRENT_CYCLE_MONTH_KEY, currentCycleMonth);

    // Sort by date then createdAt
    const sortedTransactions = currentTransactions.sort((a, b) => {
        if (a.date !== b.date) {
            return new Date(b.date) - new Date(a.date);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(sortedTransactions));

    const sortedRecords = monthlyRecords.sort((a, b) => new Date(b.month) - new Date(a.month));
    localStorage.setItem(MONTHLY_RECORDS_KEY, JSON.stringify(sortedRecords));
};

/**
 * Calculates total income, expenses, and net flow for the current cycle. (Updated)
 */
const calculateTotals = () => {
    totalIncome = currentTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

    totalExpenses = currentTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);

    // Budget Variance calculation: Monthly Budget - Total Expenses (Income not directly involved in budget variance)
    const budgetVariance = monthlyBudget - totalExpenses;
    
    // Net Flow calculation: Total Income - Total Expenses
    netFlow = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, budgetVariance, netFlow };
};

/**
 * NEW: Calculates expense totals by category and returns sorted data.
 */
const calculateCategoryExpenses = () => {
    const expenseTransactions = currentTransactions.filter(t => t.type === 'expense');

    const categorySummary = expenseTransactions
        .reduce((acc, t) => {
            // Group by category, excluding income categories if they slipped through
            if (t.category !== 'Salary' && t.category !== 'Side Hustle') {
                acc[t.category] = (acc[t.category] || 0) + t.amount;
            }
            return acc;
        }, {});

    // Convert to array of { category, amount } objects and sort descending
    return Object.keys(categorySummary)
        .map(category => ({ category, amount: categorySummary[category] }))
        .sort((a, b) => b.amount - a.amount);
};


// --- Action Functions (Updated) ---

const saveMonthlyBudget = () => {
    const input = document.getElementById('new-budget-input');
    const newBudget = parseFloat(input.value);

    if (isNaN(newBudget) || newBudget < 0) {
        alert("Please enter a valid non-negative number for the monthly budget.");
        return;
    }

    monthlyBudget = newBudget;
    renderApp();
};

const addTransaction = (event) => {
    event.preventDefault();

    const form = event.target;
    const type = form.querySelector('input[name="transaction-type"]:checked').value;
    const description = form.querySelector('#transaction-description-input').value.trim();
    const amount = parseFloat(form.querySelector('#transaction-amount-input').value);
    const category = form.querySelector('#transaction-category-select').value;
    const date = form.querySelector('#transaction-date-input').value;

    if (!description || isNaN(amount) || amount <= 0 || !date || !category) {
        alert("Please ensure all fields are valid: description, positive amount, date, and category.");
        return;
    }
    
    // Simple validation for category vs transaction type (e.g., Salary shouldn't be an expense)
    const incomeCategories = ["Salary", "Investments", "Side Hustle"];
    if (type === 'expense' && incomeCategories.includes(category)) {
         alert("Cannot log an EXPENSE with an INCOME-related category. Please select a correct category.");
         return;
    }

    const newTransaction = {
        id: generateId(),
        type: type, // 'income' or 'expense'
        description: description,
        amount: amount,
        category: category,
        date: date,
        createdAt: new Date().toISOString()
    };

    currentTransactions.unshift(newTransaction);

    // Reset form fields
    form.reset();
    form.querySelector('#transaction-date-input').value = new Date().toISOString().split('T')[0];

    renderApp();
};

const deleteTransaction = (id) => {
    if (!confirm("Are you sure you want to delete this transaction?")) {
        return;
    }
    currentTransactions = currentTransactions.filter(t => t.id !== id);
    renderApp();
};

const finalizeMonth = () => {
    const { totalIncome: finalIncome, totalExpenses: finalExpenses, netFlow: finalNetFlow } = calculateTotals();

    if (!confirm(`Finalize cycle for ${currentCycleMonth}? This archives all current data.`)) {
        return;
    }

    // New: Calculate spending by category for the monthly record
    const categorySummary = calculateCategoryExpenses(); // Use the dedicated calculation function
    const categorySummaryObject = categorySummary.reduce((acc, item) => {
        acc[item.category] = item.amount;
        return acc;
    }, {});


    const newRecord = {
        id: generateId(),
        month: currentCycleMonth,
        startingBudget: monthlyBudget,
        totalIncome: finalIncome,
        totalExpenses: finalExpenses,
        netFlow: finalNetFlow,
        categorySummary: categorySummaryObject,
        transactions: [...currentTransactions] // Archive all transactions
    };

    monthlyRecords.unshift(newRecord);

    // Reset for new month
    monthlyBudget = 0;
    currentTransactions = [];

    // Set next cycle month to the 1st day of the next month
    const currentMonthDate = new Date(currentCycleMonth);
    const nextMonth = new Date(currentMonthDate.setMonth(currentMonthDate.getMonth() + 1));
    currentCycleMonth = nextMonth.toISOString().substring(0, 7);

    renderApp();
    renderBudgetSetter(true);

    const container = document.getElementById('finalize-status');
    if (container) {
        container.innerHTML = '<p style="color: var(--success-complement); font-weight: 600;">✅ Cycle Finalized! Start setting up your new month.</p>';
        setTimeout(() => container.innerHTML = '', 4000);
    }
};

// --- UI Rendering (Major Updates) ---

/**
 * REPLACED: Renders a horizontal bar graph showing Budget vs. Expenses.
 */
const renderBudgetVisualization = () => {
    const { totalExpenses: exp, budgetVariance: variance } = calculateTotals();
    const isOver = variance < 0;
    const monthlyBudgetDisplay = monthlyBudget;

    // 1. Handle Zero/No Budget Case
    if (monthlyBudgetDisplay <= 0 && exp === 0) {
        return `
            <div style="text-align: center; padding: 24px; width: 100%;">
                <h3 style="color: var(--primary-orange);">Monthly Budget Not Set</h3>
                <p style="opacity: 0.8;">Set your monthly expense budget in the sidebar to view utilization.</p>
            </div>
        `;
    }

    // 2. Calculate percentages and define colors
    const spentPercentage = monthlyBudgetDisplay > 0 ? (exp / monthlyBudgetDisplay) * 100 : (exp > 0 ? 100 : 0);
    const normalizedSpent = Math.min(100, spentPercentage);
    const overspentAmount = Math.abs(variance);
    const remainingAmount = variance;

    const spentColor = 'var(--expense-color)';
    const overColor = 'var(--primary-orange)';
    const remainingColor = 'var(--income-color)';

    const varianceLabel = isOver 
        ? `<span style="color: ${overColor}; font-weight: 700;">- ${formatCurrency(overspentAmount)} OVER BUDGET</span>`
        : `<span style="color: ${remainingColor}; font-weight: 700;">${formatCurrency(remainingAmount)} REMAINING</span>`;
    
    // 3. Build HTML Markup for the Horizontal Bar Chart
    let barMarkup;
    if (isOver) {
         // If over budget, show a full bar for budget, and indicate overspent amount below/next to it
        barMarkup = `
            <div style="height: 20px; background-color: ${spentColor}; width: 100%; border-radius: 4px; position: relative;">
                 <span style="
                    position: absolute; 
                    top: 50%; 
                    right: 8px; 
                    transform: translateY(-50%); 
                    font-size: 0.8rem; 
                    font-weight: 800; 
                    color: var(--light-text); 
                    text-shadow: 1px 1px 2px #000;
                    z-index: 20;
                ">
                    100%
                </span>
            </div>
            <p style="text-align: left; font-size: 0.8rem; margin-top: 4px; color: ${overColor}; font-weight: 600;">
                 ${(spentPercentage).toFixed(1)}% of budget spent. (Exceeded budget amount).
            </p>
        `;
    } else {
        // Normal scenario: Expenses within budget
        barMarkup = `
            <div style="height: 20px; background-color: var(--olive-tint); width: 100%; border-radius: 4px; position: relative;">
                <div style="
                    height: 100%;
                    width: ${normalizedSpent.toFixed(1)}%;
                    background-color: ${spentColor};
                    border-radius: 4px;
                    transition: width 0.5s;
                "></div>
                <span style="
                    position: absolute; 
                    top: 50%; 
                    /* Position text near the end of the bar, but ensuring visibility */
                    left: ${Math.max(10, normalizedSpent.toFixed(1) - 5)}%; 
                    transform: translateY(-50%); 
                    font-size: 0.8rem; 
                    font-weight: 800; 
                    color: var(--light-text); 
                    text-shadow: 1px 1px 2px #000;
                    z-index: 20;
                ">
                    ${normalizedSpent.toFixed(1)}%
                </span>
            </div>
        `;
    }


    return `
        <div style="display: flex; flex-direction: column; width: 100%; padding: 12px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 0.9rem; font-weight: 600;">Budget: ${formatCurrency(monthlyBudgetDisplay)}</span>
                <span style="font-size: 0.9rem; font-weight: 600;">Expenses: ${formatCurrency(exp)}</span>
            </div>

            ${barMarkup}

            <p style="text-align: center; font-size: 1rem; font-weight: 700; margin-top: 16px;">
                ${varianceLabel}
            </p>
        </div>
    `;
};


/**
 * NEW: Renders the horizontal bar chart for category expenses.
 */
const renderCategoryBreakdownChart = () => {
    const sortedExpenses = calculateCategoryExpenses();
    const totalExpensesValue = totalExpenses; // Calculated total expenses from state

    if (sortedExpenses.length === 0) {
        return `
            <div style="text-align: center; padding: 24px; color: var(--subtle-gray); opacity: 0.7;">
                <p>Log expenses to see the category breakdown chart here.</p>
            </div>
        `;
    }

    const chartBars = sortedExpenses.map(item => {
        // Calculate bar width relative to total expenses
        const percentage = totalExpensesValue > 0 ? (item.amount / totalExpensesValue) * 100 : 0;
        
        return `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 4px;">
                    <span style="font-weight: 600;">${item.category}</span>
                    <span style="font-weight: 700; color: var(--expense-color);">${formatCurrency(item.amount)}</span>
                </div>
                <div style="height: 10px; background-color: var(--olive-tint); border-radius: 5px;">
                    <div style="
                        height: 100%;
                        width: ${percentage.toFixed(1)}%;
                        background-color: var(--primary-orange);
                        border-radius: 5px;
                        transition: width 0.5s;
                    " title="${percentage.toFixed(1)}% of total expenses"></div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div id="category-chart-container" style="padding-top: 8px;">
            ${chartBars}
        </div>
    `;
};


/**
 * Main render function to update the entire application UI structure.
 */
const renderApp = () => {
    const { totalIncome: inc, totalExpenses: exp, netFlow: flow, budgetVariance: variance } = calculateTotals();
    const isNetFlowPositive = flow >= 0;
    const netFlowCardClasses = isNetFlowPositive ? 'net-flow-positive-item' : 'net-flow-negative-item';

    // Format current cycle month for display
    const displayMonth = new Date(currentCycleMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });


    appContainer.innerHTML = `
        <h1 class="app-header">
            <span style="font-size: 2rem; margin-right: 8px; font-weight: bold;"></span>
            Expense Monitor Dashboard (${displayMonth})
        </h1>
        
        <section id="summary-section" class="card">
            <div id="visualization-container">
                ${renderBudgetVisualization()}
            </div>
            <div id="summary-grid">
                <div class="summary-item budget-item">
                    <h2>MONTHLY EXPENSE BUDGET</h2>
                    <p id="total-budget-display">
                        ${formatCurrency(monthlyBudget)}
                    </p>
                </div>
                <div class="summary-item income-item-summary">
                    <h2>TOTAL INCOME</h2>
                    <p id="total-income-display">
                        ${formatCurrency(inc)}
                    </p>
                </div>
                <div class="summary-item expense-item-summary">
                    <h2>TOTAL EXPENSES</h2>
                    <p id="total-expenses-display">
                        ${formatCurrency(exp)}
                    </p>
                </div>
                <div class="summary-item ${netFlowCardClasses}">
                    <h2>NET FLOW (Income - Expense)</h2>
                    <p id="net-flow-display">
                        ${isNetFlowPositive ? '' : '-'}${formatCurrency(flow)}
                    </p>
                </div>
            </div>
        </section>

        <div id="tab-bar">
            <button id="tab-current-btn" class="tab-btn ${currentView === 'current' ? 'active' : ''}">
                <i class="bi bi-speedometer2" style="margin-right: 8px;"></i> Active Dashboard
            </button>
            <button id="tab-history-btn" class="tab-btn ${currentView === 'history' ? 'active' : ''}">
                <i class="bi bi-archive" style="margin-right: 8px;"></i> Monthly History (${monthlyRecords.length} Cycles)
            </button>
        </div>

        <div id="view-content-container">
        </div>
    `;

    // --- 2. Attach Dynamic Renderers/Listeners ---
    attachViewEventListeners();
    renderActiveView();
    saveData();
};

const attachViewEventListeners = () => {
    document.getElementById('tab-current-btn').addEventListener('click', () => switchToView('current'));
    document.getElementById('tab-history-btn').addEventListener('click', () => switchToView('history'));
};

const switchToView = (view) => {
    if (currentView !== view) {
        currentView = view;
        renderApp();
    }
};

const renderActiveView = () => {
    const container = document.getElementById('view-content-container');
    if (!container) return;

    container.innerHTML = '';

    if (currentView === 'current') {
        container.innerHTML = renderCurrentMonthManager();

        // Attach logic
        document.getElementById('set-cycle-month-btn').addEventListener('click', setCycleMonth);
        renderBudgetSetter(monthlyBudget === 0);
        document.getElementById('add-transaction-form').addEventListener('submit', addTransaction);
        
        // Default to today's date
        document.getElementById('transaction-date-input').value = new Date().toISOString().split('T')[0];

        document.getElementById('finalize-month-btn').addEventListener('click', finalizeMonth);
        
        // Render the category chart and transaction list
        document.getElementById('category-breakdown-container').innerHTML = renderCategoryBreakdownChart();
        renderTransactionHistory();

    } else {
        container.innerHTML = renderMonthlyHistory();
    }
};

const setCycleMonth = () => {
    const input = document.getElementById('cycle-month-input');
    const newMonth = input.value;

    if (!newMonth) return;

    if (newMonth !== currentCycleMonth) {
        currentCycleMonth = newMonth;
        renderApp();
    }
};

// --- Current Month Dashboard Components ---

const renderCurrentMonthManager = () => {
    const today = new Date().toISOString().split('T')[0];
    const displayMonth = new Date(currentCycleMonth + '-01').toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric'
    });

    // Generate Category Options
    const categoryOptions = categories.map(cat => 
        `<option value="${cat}">${cat}</option>`
    ).join('');
    
    // Default selected category for expense
    const defaultExpenseCategory = categories.find(cat => cat === 'Groceries');

    return `
        <div id="current-dashboard-grid">
            
            <div id="dashboard-main-column">
                
                <section class="card" id="add-transaction-card">
                    <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid var(--olive-tint); padding-bottom: 8px;">
                        Log New Transaction
                    </h2>
                    <form id="add-transaction-form" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                        <div style="grid-column: span 4; display: flex; gap: 16px;">
                            <label style="font-weight: 600;">
                                <input type="radio" name="transaction-type" value="expense" checked style="margin-right: 8px;" />
                                Expense (<span style="color:var(--expense-color);">Outflow</span>)
                            </label>
                            <label style="font-weight: 600;">
                                <input type="radio" name="transaction-type" value="income" style="margin-right: 8px;" />
                                Income (<span style="color:var(--income-color);">Inflow</span>)
                            </label>
                        </div>

                        <input type="text" id="transaction-description-input" placeholder="Description/Merchant" required style="grid-column: span 2;" />
                        
                        <input type="number" id="transaction-amount-input" placeholder="Amount (150.75)"
                            min="0.01" step="0.01" required />
                        
                        <select id="transaction-category-select" required>
                            <option value="" disabled>Select Category</option>
                            ${categoryOptions}
                        </select>
                        
                        <input type="date" id="transaction-date-input" style="grid-column: span 2;" max="${today}" required />

                        <button type="submit" class="btn btn-primary" style="grid-column: span 2;">
                            Log Transaction for ${displayMonth}
                        </button>
                    </form>
                </section>

                <section class="card" id="category-breakdown-card">
                    <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid var(--olive-tint); padding-bottom: 8px;">
                        Category Spending Breakdown (Ranked)
                    </h2>
                    <div id="category-breakdown-container">
                        </div>
                </section>
                <section class="card" id="transaction-history-card" style="flex-grow: 1;">
                    <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid var(--olive-tint); padding-bottom: 8px;">
                        Transaction Log (Current Month)
                    </h2>
                    <div id="history-list-container" style="max-height: 400px; overflow-y: auto;">
                    </div>
                </section>
            </div>

            
            <div id="dashboard-actions-column">
                
                <section id="budget-setter-card" class="card"></section>

                <section class="card" id="date-setter-card">
                    <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 12px; color: var(--primary-orange);">
                        Budget Cycle: ${displayMonth}
                    </h2>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <input type="month" id="cycle-month-input" value="${currentCycleMonth}" style="flex-grow: 1;" required />
                        <button id="set-cycle-month-btn" class="btn btn-success" style="padding: 12px 16px; flex-shrink: 0;">
                            Set
                        </button>
                    </div>
                    <p style="margin-top: 10px; font-size: 0.85rem; color: var(--light-text); opacity: 0.6;">
                        All new transactions will be attributed to this month.
                    </p>
                </section>

                <section class="card" id="finalize-card" style="background-color: var(--olive-tint);">
                    <h2 style="font-size: 1.25rem; font-weight: 700; color: var(--primary-orange); margin-bottom: 16px;">
                        Archive Month
                    </h2>
                    <p style="font-size: 0.9rem; color: var(--light-text); margin-bottom: 12px;">
                        Finalize and archive the current month's transactions and summaries.
                    </p>
                    <button id="finalize-month-btn" class="btn btn-primary" style="width: 100%;">
                        Finalize & Start New Month
                    </button>
                    <div id="finalize-status" style="margin-top: 10px; text-align: center;"></div>
                </section>

            </div>
        </div>
    `;
};

const renderBudgetSetter = (isEditing = false) => {
    const container = document.getElementById('budget-setter-card');
    if (!container) return;

    const currentBudgetDisplay = formatCurrency(monthlyBudget);

    if (isEditing) {
        container.innerHTML = `
            <h2 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 16px; border-bottom: 1px solid var(--olive-tint); padding-bottom: 8px;">
                Set/Update Monthly Budget
            </h2>
            <div style="display: flex; gap: 8px;">
                <input type="number" id="new-budget-input" placeholder="Enter New Budget Amount" value="${monthlyBudget.toFixed(2)}"
                    min="0" step="0.01" style="flex-grow: 1;" required />
                <button id="save-budget-btn" class="btn btn-success">Save</button>
            </div>
        `;
        document.getElementById('save-budget-btn').addEventListener('click', saveMonthlyBudget);
    } else {
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="font-size: 0.9rem; opacity:0.7; margin-bottom:4px;">Current Monthly Expense Budget</h2>
                    <div style="font-size: 1.5rem; font-weight:bold; color:var(--primary-orange);">${currentBudgetDisplay}</div>
                </div>
                <button id="edit-budget-btn" class="btn btn-primary">Edit</button>
            </div>
        `;
        document.getElementById('edit-budget-btn').addEventListener('click', () => renderBudgetSetter(true));
    }
};

const renderTransactionHistory = () => {
    const container = document.getElementById('history-list-container');
    if (!container) return;

    if (currentTransactions.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 24px; color: var(--subtle-gray); opacity: 0.7;">
                <p>No transactions logged for this month yet.</p>
            </div>
        `;
        return;
    }

    // Group transactions by date for better viewing
    const transactionsByDate = currentTransactions.reduce((acc, t) => {
        const date = t.date;
        if (!acc[date]) acc[date] = [];
        acc[date].push(t);
        return acc;
    }, {});

    const sortedDates = Object.keys(transactionsByDate).sort((a, b) => new Date(b) - new Date(a));

    container.innerHTML = sortedDates.map(date => {
        const displayDate = new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        const dateTransactions = transactionsByDate[date].map(item => {
            const isIncome = item.type === 'income';
            const amountClass = isIncome ? 'income-amount' : 'expense-amount';
            const sign = isIncome ? '+' : '-';
            const icon = isIncome ? '<i class="bi bi-arrow-up-circle-fill"></i>' : '<i class="bi bi-arrow-down-circle-fill"></i>';

            return `
                <div class="transaction-item ${item.type}" style="border-left-width: 6px;">
                    <div class="transaction-item-details">
                        <strong>${item.description}</strong>
                        <small>${item.category} | ${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                    </div>
                    <div class="transaction-amount-actions" style="display:flex; align-items:center; gap:12px;">
                        ${icon}
                        <span class="amount ${amountClass}">${sign} ${formatCurrency(item.amount)}</span>
                        <button class="delete-btn" onclick="deleteTransaction('${item.id}')" title="Delete Entry">
                            <i class="bi bi-trash-fill"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div style="margin-bottom: 16px;">
                <h4 style="margin: 0; padding: 8px 0; border-bottom: 1px dashed var(--olive-tint); font-size: 1rem; color: var(--light-text);">
                    ${displayDate}
                </h4>
                ${dateTransactions}
            </div>
        `;
    }).join('');
};


const renderMonthlyHistory = () => {
    if (monthlyRecords.length === 0) {
        return `
            <div class="card" style="text-align: center; padding: 40px;">
                <h3 style="color: var(--light-text);">No Monthly Archive Records Found</h3>
                <p style="opacity: 0.7;">Finalize a month's cycle to see it appear in your history.</p>
            </div>
        `;
    }

    return `
        <div class="card" id="history-archive-card">
            ${monthlyRecords.map(record => {
                const isDeficit = record.netFlow < 0;
                const displayMonth = new Date(record.month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

                // Format category summary for display
                const categoryList = Object.entries(record.categorySummary || {}) // Added null check for old records
                    .sort(([, a], [, b]) => b - a) // Sort by amount descending
                    .map(([category, amount]) => `
                        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.1); font-size:0.85rem;">
                            <span>${category}</span>
                            <span>${formatCurrency(amount)}</span>
                        </div>
                    `).join('');


                return `
                    <div class="history-record ${isDeficit ? 'deficit' : ''}">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <h3 style="margin:0; font-size:1.2rem;"><i class="bi bi-calendar-event" style="font-size:1.2rem; padding-right: 8px;"></i>${displayMonth}</h3>
                            <span style="font-weight:bold; font-size:1rem; color:${isDeficit ? 'var(--expense-color)' : 'var(--income-color)'};">
                                Net Flow: ${isDeficit ? '-' : ''}${formatCurrency(record.netFlow)}
                            </span>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:16px; font-size:0.9rem; margin-bottom:12px;">
                            <div>Budget: <strong style="color: var(--primary-orange);">${formatCurrency(record.startingBudget)}</strong></div>
                            <div>Income: <strong style="color: var(--income-color);">${formatCurrency(record.totalIncome)}</strong></div>
                            <div>Expenses: <strong style="color: var(--expense-color);">${formatCurrency(record.totalExpenses)}</strong></div>
                            <div>Variance: <strong style="color: ${record.startingBudget - record.totalExpenses >= 0 ? 'var(--income-color)' : 'var(--expense-color)'};">${formatCurrency(record.startingBudget - record.totalExpenses)}</strong></div>
                        </div>
                        <details>
                            <summary style="cursor:pointer; color:var(--primary-orange); font-size:0.9rem; font-weight:600;">View Category Summary (${Object.keys(record.categorySummary || {}).length} categories)</summary>
                            <div style="margin-top:12px; background:rgba(0,0,0,0.2); padding:12px; border-radius:8px;">
                                <h4 style="margin-top:0; color:var(--light-text); font-size:1rem; border-bottom:1px solid var(--subtle-gray);">Expense Breakdown</h4>
                                ${categoryList}
                            </div>
                        </details>
                        <details style="margin-top: 10px;">
                             <summary style="cursor:pointer; color:var(--primary-orange); font-size:0.9rem; font-weight:600;">View ${record.transactions.length} Total Transactions</summary>
                             <div style="margin-top:12px; background:rgba(0,0,0,0.2); padding:8px; border-radius:8px;">
                                 ${record.transactions.map(t => `
                                     <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.1); font-size:0.85rem;">
                                         <span style="color: ${t.type === 'income' ? 'var(--income-color)' : 'var(--expense-color)'};">[${t.type.toUpperCase()}]</span>
                                         <span>${t.description} (${t.category})</span>
                                         <span>${formatCurrency(t.amount)}</span>
                                     </div>
                                 `).join('')}
                             </div>
                        </details>
                    </div>
                    `;
            }).join('')}
        </div>
    `;
};

// --- Initialization ---
loadData();
renderApp();