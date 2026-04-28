/**
 * Firebase Admin SDK Configuration
 * Handles Firebase Auth, Firestore, and FCM
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseApp = null;

/**
 * Initialize Firebase Admin SDK
 * Supports both service account file and environment variables
 */
const initializeFirebase = () => {
    if (firebaseApp) {
        return firebaseApp;
    }

    try {
        let credential;

        // Option 1: Use JSON from environment variable (for production/Render)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            console.log('Firebase JSON env found, length:', process.env.FIREBASE_SERVICE_ACCOUNT_JSON.length);
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            credential = admin.credential.cert(serviceAccount);
            console.log('Using Firebase service account from env variable');
        }
        // Option 2: Use service account file (for local development)
        else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
            const absolutePath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
            if (fs.existsSync(absolutePath)) {
                const serviceAccount = require(absolutePath);
                credential = admin.credential.cert(serviceAccount);
                console.log('Using Firebase service account file');
            }
        }
        else {
            console.log('❌ FIREBASE_SERVICE_ACCOUNT_JSON not found in env');
        }

        firebaseApp = admin.initializeApp({
            credential,
            projectId: process.env.FIREBASE_PROJECT_ID || 'job-assigning-app',
        });

        console.log('Firebase Admin SDK initialized successfully');
        return firebaseApp;

    } catch (error) {
        console.error('Firebase initialization error:', error.message);
        console.warn('Firebase features will be limited.');
        return null;
    }
};

/**
 * Get Firebase Auth instance
 * @returns {admin.auth.Auth}
 */
const getAuth = () => {
    if (!firebaseApp) {
        initializeFirebase();
    }
    return admin.auth();
};

/**
 * Get Firestore instance
 * @returns {admin.firestore.Firestore}
 */
const getFirestore = () => {
    if (!firebaseApp) {
        initializeFirebase();
    }
    return admin.firestore();
};

/**
 * Get Firebase Cloud Messaging instance
 * @returns {admin.messaging.Messaging}
 */
const getMessaging = () => {
    if (!firebaseApp) {
        initializeFirebase();
    }
    return admin.messaging();
};

/**
 * Verify Firebase ID token
 * @param {string} idToken - Firebase ID token
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
const verifyIdToken = async (idToken) => {
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        return decodedToken;
    } catch (error) {
        console.error('Token verification failed:', error.message);
        throw error;
    }
};


module.exports = {
    initializeFirebase,
    getAuth,
    getFirestore,
    getMessaging,
    verifyIdToken,
};
