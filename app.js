// Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    child, 
    update, 
    push,
    onValue 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAXqO23ggcNB_btxIEMJDPHOSM1OGdG4oc",
    authDomain: "big-winner-91782.firebaseapp.com",
    databaseURL: "https://big-winner-91782-default-rtdb.firebaseio.com",
    projectId: "big-winner-91782",
    storageBucket: "big-winner-91782.firebasestorage.app",
    messagingSenderId: "1088925682784",
    appId: "1:1088925682784:web:69462cd6a702422ebb0705",
    measurementId: "G-L5Z6VY870S"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);

// Global Variables
let currentUser = null;
let currentUserId = null;
let walletBalance = 2400;

// DOM Elements
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
}

// Check Session
function checkSession() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        currentUserId = currentUser.userId;
        loadUserData().then(() => {
            showPage('homePage');
        });
    }
}

// Handle Login
async function handleLogin(e) {
    e.preventDefault();
    
    const userId = document.getElementById('userId').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!userId || !password) {
        showError('Please enter both User ID and Password');
        return;
    }
    
    try {
        const userRef = ref(database, `users/${userId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const userData = snapshot.val();
            
            if (userData.password === password) {
                // Login Success
                currentUserId = userId;
                currentUser = {
                    userId: userId,
                    ...userData
                };
                
                // Save to session
                sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
                
                // Initialize wallet if not exists
                if (!userData.walletBalance) {
                    await update(userRef, { walletBalance: 2400 });
                    walletBalance = 2400;
                } else {
                    walletBalance = userData.walletBalance;
                }
                
                // Clear form
                document.getElementById('userId').value = '';
                document.getElementById('password').value = '';
                showError('');
                
                // Load user data and redirect
                await loadUserData();
                showPage('homePage');
                
            } else {
                showError('Incorrect password. Please try again.');
            }
        } else {
            // Create new user if not exists
            await createNewUser(userId, password);
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Connection error. Please try again.');
    }
}

// Create New User
async function createNewUser(userId, password) {
    try {
        const userRef = ref(database, `users/${userId}`);
        const newUser = {
            password: password,
            walletBalance: 2400,
            purchaseHistory: {},
            redeemHistory: {},
            createdAt: new Date().toISOString()
        };
        
        await set(userRef, newUser);
        
        currentUserId = userId;
        currentUser = {
            userId: userId,
            ...newUser
        };
        
        walletBalance = 2400;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        document.getElementById('userId').value = '';
        document.getElementById('password').value = '';
        showError('');
        
        showPage('homePage');
        
    } catch (error) {
        console.error('Error creating user:', error);
        showError('Error creating account. Please try again.');
    }
}

// Load User Data
async function loadUserData() {
    if (!currentUserId) return;
    
    try {
        const userRef = ref(database, `users/${currentUserId}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
            const data = snapshot.val();
            walletBalance = data.walletBalance || 2400;
            
            // Update UI
            updateWalletDisplay();
            document.getElementById('displayUserId').textContent = `👤 ${currentUserId}`;
            
            // Load histories
            loadPurchaseHistory(data.purchaseHistory);
            loadRedeemHistory(data.redeemHistory);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Update Wallet Display
function updateWalletDisplay() {
    const balanceElements = [
        document.getElementById('walletBalanceDisplay'),
        document.getElementById('buyWalletBalance')
    ];
    
    balanceElements.forEach(el => {
        if (el) el.textContent = `₹${walletBalance}`;
    });
}

// Show Page
function showPage(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    // Show target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo(0, 0);
    }
    
    // Refresh data if needed
    if (pageId === 'walletPage' || pageId === 'buyCouponPage') {
        loadUserData();
    }
}

// Buy Coupon
async function buyCoupon() {
    const errorEl = document.getElementById('buyError');
    const resultEl = document.getElementById('couponResult');
    const couponCodeEl = document.getElementById('generatedCoupon');
    const buyBtn = document.getElementById('buyCouponBtn');
    
    // Check balance
    if (walletBalance < 100) {
        errorEl.textContent = '❌ Insufficient Balance! You need at least ₹100.';
        resultEl.classList.add('hidden');
        return;
    }
    
    // Disable button
    buyBtn.disabled = true;
    buyBtn.innerHTML = '<span class="loading"></span> Processing...';
    
    try {
        // Generate unique coupon code
        const couponCode = generateCouponCode();
        const timestamp = new Date().toISOString();
        
        // Deduct balance
        const newBalance = walletBalance - 100;
        
        // Update database
        const userRef = ref(database, `users/${currentUserId}`);
        const purchaseRef = push(child(userRef, 'purchaseHistory'));
        
        const purchaseData = {
            couponCode: couponCode,
            amount: 100,
            date: timestamp,
            status: 'active'
        };
        
        await update(userRef, {
            walletBalance: newBalance
        });
        
        await set(purchaseRef, purchaseData);
        
        // Update local
        walletBalance = newBalance;
        updateWalletDisplay();
        
        // Show result
        couponCodeEl.textContent = couponCode;
        resultEl.classList.remove('hidden');
        errorEl.textContent = '';
        
        // Reset button
        buyBtn.disabled = false;
        buyBtn.innerHTML = 'Buy Coupon (₹100)';
        
        // Refresh history
        await loadUserData();
        
    } catch (error) {
        console.error('Error buying coupon:', error);
        errorEl.textContent = '❌ Error processing purchase. Please try again.';
        buyBtn.disabled = false;
        buyBtn.innerHTML = 'Buy Coupon (₹100)';
    }
}

// Generate Coupon Code
function generateCouponCode() {
    const prefix = 'WIN';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${code}`;
}

// Copy Coupon
async function copyCoupon() {
    const couponCode = document.getElementById('generatedCoupon').textContent;
    const copyMsg = document.getElementById('copyMessage');
    
    try {
        await navigator.clipboard.writeText(couponCode);
        copyMsg.textContent = '✅ Copied to clipboard!';
        
        setTimeout(() => {
            copyMsg.textContent = '';
        }, 3000);
    } catch (err) {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = couponCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        copyMsg.textContent = '✅ Copied to clipboard!';
        setTimeout(() => {
            copyMsg.textContent = '';
        }, 3000);
    }
}

// Redeem Coupon
async function redeemCoupon() {
    const inputEl = document.getElementById('couponInput');
    const errorEl = document.getElementById('redeemError');
    const successEl = document.getElementById('redeemSuccess');
    const couponCode = inputEl.value.trim().toUpperCase();
    
    errorEl.textContent = '';
    successEl.textContent = '';
    
    if (!couponCode) {
        errorEl.textContent = '❌ Please enter a coupon code';
        return;
    }
    
    try {
        // Check all users for this coupon
        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        
        let found = false;
        let ownerId = null;
        let purchaseKey = null;
        let purchaseData = null;
        
        if (snapshot.exists()) {
            const users = snapshot.val();
            
            for (const [uid, userData] of Object.entries(users)) {
                if (userData.purchaseHistory) {
                    for (const [key, purchase] of Object.entries(userData.purchaseHistory)) {
                        if (purchase.couponCode === couponCode && purchase.status !== 'redeemed') {
                            found = true;
                            ownerId = uid;
                            purchaseKey = key;
                            purchaseData = purchase;
                            break;
                        }
                    }
                }
                if (found) break;
            }
        }
        
        if (!found) {
            errorEl.textContent = '❌ Invalid or already redeemed coupon code!';
            return;
        }
        
        // Save redemption history
        const redeemRef = push(ref(database, `users/${currentUserId}/redeemHistory`));
        const redeemData = {
            couponCode: couponCode,
            redeemedFrom: ownerId,
            date: new Date().toISOString()
        };
        
        await set(redeemRef, redeemData);
        
        // Mark as redeemed in owner's history
        await update(ref(database, `users/${ownerId}/purchaseHistory/${purchaseKey}`), {
            status: 'redeemed',
            redeemedBy: currentUserId,
            redeemedAt: new Date().toISOString()
        });
        
        successEl.textContent = '✅ Coupon redeemed successfully! Redirecting...';
        
        setTimeout(() => {
            window.location.href = 'https://web.hkweblink.com/#/register/4d389a8M4D';
        }, 2000);
        
    } catch (error) {
        console.error('Error redeeming coupon:', error);
        errorEl.textContent = '❌ Error redeeming coupon. Please try again.';
    }
}

// Load Purchase History
function loadPurchaseHistory(history) {
    const container = document.getElementById('purchaseHistory');
    
    if (!history || Object.keys(history).length === 0) {
        container.innerHTML = '<p class="empty-state">No purchases yet</p>';
        return;
    }
    
    let html = '';
    const sortedHistory = Object.entries(history).sort((a, b) => 
        new Date(b[1].date) - new Date(a[1].date)
    );
    
    sortedHistory.forEach(([key, item]) => {
        const date = new Date(item.date).toLocaleString('en-IN');
        const status = item.status === 'redeemed' ? ' (Redeemed)' : '';
        html += `
            <div class="history-item">
                <div class="info">
                    <div class="code">${item.couponCode}${status}</div>
                    <div class="date">${date}</div>
                </div>
                <div class="amount">-₹${item.amount}</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Load Redeem History
function loadRedeemHistory(history) {
    const container = document.getElementById('redeemHistory');
    
    if (!history || Object.keys(history).length === 0) {
        container.innerHTML = '<p class="empty-state">No redemptions yet</p>';
        return;
    }
    
    let html = '';
    const sortedHistory = Object.entries(history).sort((a, b) => 
        new Date(b[1].date) - new Date(a[1].date)
    );
    
    sortedHistory.forEach(([key, item]) => {
        const date = new Date(item.date).toLocaleString('en-IN');
        html += `
            <div class="history-item redeem">
                <div class="info">
                    <div class="code">${item.couponCode}</div>
                    <div class="date">${date}</div>
                </div>
                <div class="amount credit">Success</div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Copy Referral Code
async function copyReferral() {
    const code = document.getElementById('referralCode').textContent;
    
    try {
        await navigator.clipboard.writeText(code);
        alert('Referral code copied: ' + code);
    } catch (err) {
        const textArea = document.createElement('textarea');
        textArea.value = code;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Referral code copied: ' + code);
    }
}

// Logout
function logout() {
    currentUser = null;
    currentUserId = null;
    walletBalance = 2400;
    sessionStorage.removeItem('currentUser');
    showPage('loginPage');
}

// Show Error
function showError(message) {
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
        errorEl.textContent = message;
    }
}

// Make functions global for onclick handlers
window.showPage = showPage;
window.buyCoupon = buyCoupon;
window.copyCoupon = copyCoupon;
window.redeemCoupon = redeemCoupon;
window.copyReferral = copyReferral;
window.logout = logout;
