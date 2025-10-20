// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCpHDvnEg3YRAWhY4hopWQ84-0rT_cXaD0",
  authDomain: "eduhub-pro-app.firebaseapp.com",
  projectId: "eduhub-pro-app",
  storageBucket: "eduhub-pro-app.firebasestorage.app",
  messagingSenderId: "929983823353",
  appId: "1:929983823353:web:35502e98630f6460659128",
  measurementId: "G-9BM2BBQLRJ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const { jsPDF } = window.jspdf;

let currentUser = null;
let peer = null;
let localStream = null;

// Initialize sample data
async function initData() {
    const studentsRef = db.collection('students');
    const snapshot = await studentsRef.get();
    if (snapshot.empty) {
        const students = Array.from({length: 20}, (_, i) => ({
            id: i + 1,
            name: `Student ${i + 1}`,
            parentContact: `+1-555-${String(i+1).padStart(3,'0')}-000`,
            email: `student${i+1}@edu.com`
        }));
        students.forEach(student => studentsRef.doc(student.email).set(student));
    }
}

// Auth State Listener
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = { email: user.email, role: localStorage.getItem('userRole') || 'student' };
        document.getElementById('user-role').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
        closeModal('login-modal');
        loadDashboard();
        console.log('User logged in:', currentUser);
    } else {
        currentUser = null;
        document.getElementById('user-role').textContent = 'Guest';
        document.getElementById('login-modal').classList.add('active');
    }
});

// Login
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const role = document.getElementById('login-role').value;
        if (!email || !password) {
            alert('Please enter both email and password.');
            return;
        }
        await auth.signInWithEmailAndPassword(email, password);
        localStorage.setItem('userRole', role);
        await db.collection('users').doc(email).set({ role }, { merge: true });
        console.log('Login successful:', email, role);
    } catch (err) {
        console.error('Login error:', err);
        alert(`Login failed: ${err.message}`);
    }
});

// Enter key support
document.getElementById('login-form').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('login-form').dispatchEvent(new Event('submit'));
    }
});

// Sign Up
async function signup() {
    try {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const role = document.getElementById('login-role').value;
        if (!email || !password) {
            alert('Please enter both email and password.');
            return;
        }
        await auth.createUserWithEmailAndPassword(email, password);
        localStorage.setItem('userRole', role);
        await db.collection('users').doc(email).set({ role });
        console.log('Sign up successful:', email, role);
    } catch (err) {
        console.error('Sign up error:', err);
        alert(`Sign up failed: ${err.message}`);
    }
}

// Modal Close
function closeModal(id) {
    try {
        const modal = document.getElementById(id);
        modal.classList.remove('active');
        console.log(`Closed modal: ${id}`);
    } catch (err) {
        console.error('Close modal error:', err);
        alert('Error closing modal.');
    }
}

document.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.closest('.modal').id));
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        closeModal(btn.closest('.modal').id);
    });
});

async function loadDashboard() {
    const dashboard = document.getElementById('dashboard');
    dashboard.innerHTML = '';
    const students = [];
    (await db.collection('students').get()).forEach(doc => students.push(doc.data()));
    
    if (currentUser?.role === 'teacher') {
        dashboard.innerHTML = `
            <div class="card">
                <h3>📝 Take Attendance</h3>
                <select id="student-select">
                    ${students.map(s => `<option value="${s.email}">${s.name}</option>`).join('')}
                </select>
                <button class="btn btn-primary" onclick="markAttendance()">Mark Present</button>
                <button class="btn" style="background: var(--warning); color: white;" onclick="sendAbsentMsg()">Send Absent Alert</button>
            </div>
            <div class="card">
                <h3>💰 Payment Reminders</h3>
                <button class="btn btn-primary" onclick="sendPaymentReminder()">Send Monthly Reminders</button>
            </div>
            <div class="card">
                <h3>📚 Upload Notes</h3>
                <input type="file" id="notes-file" accept=".pdf,.doc">
                <button class="btn btn-primary" onclick="uploadNotes()">Upload</button>
                <div id="notes-list"></div>
            </div>
            <div class="card">
                <h3>🔔 Announcements</h3>
                <textarea id="announcement-text" placeholder="Type announcement..."></textarea>
                <button class="btn btn-primary" onclick="sendAnnouncement()">Send to Group</button>
            </div>
            <div class="card">
                <h3>❓ Doubt Solving</h3>
                <textarea id="doubt-text" placeholder="Post your doubt..."></textarea>
                <button class="btn btn-primary" onclick="postDoubt()">Post Doubt</button>
                <div id="doubts-list"></div>
            </div>
            <div class="card">
                <h3>📹 Start Live Class</h3>
                <button class="btn btn-primary" onclick="startVideoCall()">Start Video Class</button>
            </div>
            <div class="card">
                <h3>📊 Export Reports</h3>
                <button class="btn btn-primary" onclick="exportAttendancePDF('monthly')">Monthly PDF</button>
                <button class="btn btn-primary" onclick="exportAttendancePDF('annual')">Annual PDF</button>
            </div>
        `;
        loadNotes();
        loadDoubts();
    } else if (currentUser?.role === 'student' || currentUser?.role === 'parent') {
        dashboard.innerHTML = `
            <div class="card">
                <h3>📊 My Status</h3>
                <p>Attendance: ${await calculateAttendanceRate()}%</p>
                <p>Marks: ${Math.floor(Math.random() * 100)}/100</p>
                <p>Payment: ${(await db.collection('payments').doc(currentUser.email).get()).data()?.verified ? 'Paid' : 'Pending'}</p>
            </div>
            <div class="card">
                <h3>📚 Notes & Materials</h3>
                <div id="student-notes"></div>
            </div>
            <div class="card">
                <h3>🔔 Announcements</h3>
                <div id="student-announcements"></div>
            </div>
            <div class="card">
                <h3>❓ Doubts</h3>
                <textarea id="doubt-text" placeholder="Post doubt..."></textarea>
                <button class="btn btn-primary" onclick="postDoubt()">Post</button>
                <div id="student-doubts"></div>
            </div>
            <div class="card">
                <h3>📝 Online Test</h3>
                <button class="btn btn-primary" onclick="startProctoredTest()">Take Test</button>
            </div>
        `;
        loadNotes();
        loadDoubts();
    } else {
        dashboard.innerHTML = '<p>Please log in to view your dashboard.</p>';
    }
}

async function markAttendance() {
    try {
        const studentEmail = document.getElementById('student-select').value;
        const date = new Date().toISOString().split('T')[0];
        await db.collection('attendance').add({ studentEmail, date, present: true });
        alert('Attendance marked!');
    } catch (err) {
        console.error('Attendance error:', err);
        alert('Failed to mark attendance.');
    }
}

async function sendAbsentMsg() {
    try {
        const studentEmail = document.getElementById('student-select').value;
        const student = (await db.collection('students').doc(studentEmail).get()).data();
        if (confirm(`Send to ${student.parentContact}: Reason for absence?`)) {
            alert(`Message sent to ${student.parentContact}: Please provide reason for ${student.name}'s absence.`);
        }
    } catch (err) {
        console.error('Absent message error:', err);
        alert('Failed to send absent message.');
    }
}

async function sendPaymentReminder() {
    try {
        const students = [];
        (await db.collection('students').get()).forEach(doc => students.push(doc.data()));
        for (const s of students) {
            const payment = (await db.collection('payments').doc(s.email).get()).data();
            if (!payment?.verified) {
                alert(`Reminder sent to ${s.parentContact} for ${s.name}`);
                await db.collection('payments').doc(s.email).set({ verified: false, reminded: true }, { merge: true });
            }
        }
    } catch (err) {
        console.error('Payment reminder error:', err);
        alert('Failed to send payment reminders.');
    }
}

async function uploadNotes() {
    try {
        const file = document.getElementById('notes-file').files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            await db.collection('notes').add({ name: file.name, url, uploadedBy: currentUser.email, timestamp: new Date() });
            loadNotes();
        }
    } catch (err) {
        console.error('Note upload error:', err);
        alert('Failed to upload note.');
    }
}

async function loadNotes() {
    try {
        const notesList = document.getElementById('notes-list') || document.getElementById('student-notes');
        if (notesList) {
            const notes = [];
            (await db.collection('notes').orderBy('timestamp', 'desc').get()).forEach(doc => notes.push(doc.data()));
            notesList.innerHTML = notes.map(n => `<p>${n.name} <button onclick="downloadNote('${n.url}')">Download</button></p>`).join('');
        }
    } catch (err) {
        console.error('Load notes error:', err);
    }
}

function downloadNote(url) {
    window.open(url);
}

async function sendAnnouncement() {
    try {
        const text = document.getElementById('announcement-text').value.trim();
        if (text) {
            await db.collection('announcements').add({ text, by: currentUser.email, timestamp: new Date() });
            alert('Announcement sent!');
            document.getElementById('announcement-text').value = '';
            loadAnnouncements();
        }
    } catch (err) {
        console.error('Announcement error:', err);
        alert('Failed to send announcement.');
    }
}

async function loadAnnouncements() {
    try {
        const announcementsList = document.getElementById('student-announcements');
        if (announcementsList) {
            const announcements = [];
            (await db.collection('announcements').orderBy('timestamp', 'desc').get()).forEach(doc => announcements.push(doc.data()));
            announcementsList.innerHTML = announcements.map(a => `<p><strong>${a.by}:</strong> ${a.text}</p>`).join('');
        }
    } catch (err) {
        console.error('Load announcements error:', err);
    }
}

async function postDoubt() {
    try {
        const text = document.getElementById('doubt-text').value.trim();
        if (text) {
            await db.collection('doubts').add({ text, by: currentUser.email, timestamp: new Date() });
            document.getElementById('doubt-text').value = '';
            loadDoubts();
        }
    } catch (err) {
        console.error('Doubt post error:', err);
        alert('Failed to post doubt.');
    }
}

async function loadDoubts() {
    try {
        const doubtsList = document.getElementById('doubts-list') || document.getElementById('student-doubts');
        if (doubtsList) {
            const doubts = [];
            (await db.collection('doubts').orderBy('timestamp', 'desc').get()).forEach(doc => doubts.push(doc.data()));
            doubtsList.innerHTML = doubts.map(d => `<p><strong>${d.by}:</strong> ${d.text}</p>`).join('');
        }
    } catch (err) {
        console.error('Load doubts error:', err);
    }
}

async function startVideoCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('local-video').srcObject = localStream;
        peer = new Peer({ initiator: true });
        peer.on('signal', data => {
            console.log('Signal:', JSON.stringify(data));
            prompt('Share this peer ID with student/parent:', JSON.stringify(data));
        });
        peer.on('stream', stream => {
            document.getElementById('remote-video').srcObject = stream;
        });
        document.getElementById('video-modal').classList.add('active');
        document.getElementById('share-screen').onclick = async () => {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                localStream.getVideoTracks()[0].replaceTrack(screenStream.getVideoTracks()[0]);
            } catch (err) {
                console.error('Screen share error:', err);
                alert('Failed to share screen.');
            }
        };
        document.getElementById('end-call').onclick = () => {
            localStream.getTracks().forEach(track => track.stop());
            peer.destroy();
            closeModal('video-modal');
        };
        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const msg = e.target.value.trim();
                if (msg) {
                    document.getElementById('chat-messages').innerHTML += `<div class="chat-message"><strong>You:</strong> ${msg}</div>`;
                    if (peer) peer.send(msg);
                    e.target.value = '';
                }
            }
        });
        peer.on('data', data => {
            document.getElementById('chat-messages').innerHTML += `<div class="chat-message"><strong>Peer:</strong> ${data}</div>`;
        });
    } catch (err) {
        console.error('Video call error:', err);
        alert('Failed to start video call. Check camera/mic permissions.');
    }
}

function startProctoredTest() {
    if (currentUser?.role !== 'student') return alert('Only for students');
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            document.getElementById('proctor-alert').style.display = 'block';
            setTimeout(() => document.getElementById('proctor-alert').style.display = 'none', 3000);
            alert('Test ended due to tab switch.');
        }
    });
    document.body.requestFullscreen().catch(() => {});
    const testModal = document.createElement('div');
    testModal.className = 'modal';
    testModal.id = 'test-modal';
    testModal.innerHTML = `
        <div class="modal-content">
            <span class="close" onclick="closeModal('test-modal')">&times;</span>
            <h2>Online Test</h2>
            <p>Question 1: 2+2=?</p>
            <input type="number" id="test-answer">
            <button class="btn btn-primary" onclick="submitTest()">Submit</button>
        </div>
    `;
    document.body.appendChild(testModal);
    testModal.classList.add('active');
}

function submitTest() {
    alert('Submitted! Score: 100%');
    document.exitFullscreen();
    document.getElementById('test-modal').remove();
}

async function exportAttendancePDF(period) {
    try {
        const doc = new jsPDF();
        doc.setFontSize(20);
        doc.text('Attendance Report', 20, 20);
        let y = 40;
        const students = [];
        (await db.collection('students').get()).forEach(doc => students.push(doc.data()));
        for (const s of students) {
            const att = [];
            (await db.collection('attendance').where('studentEmail', '==', s.email).get()).forEach(doc => att.push(doc.data()));
            const rate = att.filter(a => a.present).length / att.length * 100 || 0;
            doc.text(`${s.name}: ${rate.toFixed(1)}%`, 20, y);
            y += 10;
        }
        doc.save(`${period}_attendance.pdf`);
    } catch (err) {
        console.error('PDF export error:', err);
        alert('Failed to export PDF.');
    }
}

async function calculateAttendanceRate() {
    try {
        if (!currentUser) return 0;
        const att = [];
        (await db.collection('attendance').where('studentEmail', '==', currentUser.email).get()).forEach(doc => att.push(doc.data()));
        return att.filter(a => a.present).length / att.length * 100 || 0;
    } catch (err) {
        console.error('Attendance rate error:', err);
        return 0;
    }
}

function logout() {
    auth.signOut();
    localStorage.removeItem('userRole');
    document.getElementById('dashboard').innerHTML = '';
}

// Initialize
initData();
loadAnnouncements();
