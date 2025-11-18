import { test, expect } from '@playwright/test';

// Konfigurasi dasar
const base = 'https://reportaction.dbsnetwork.my.id';
const loginUrl = `${base}/login`;
const manageUserUrl = `${base}/user`;
const dashboardUrl = `${base}/`; 

// Data unik agar tidak konflik antar run test
const timestamp = Date.now();
const uniqueUsername = `testuser_${timestamp}`;
const uniqueNoInduk = `99${timestamp.toString().slice(-10)}`;

const adminUser = { username: 'admin', password: 'admin' };

let testUser = {
    username: uniqueUsername,
    password: 'passwordtest123',
    nama: 'User Test Playwright',
    no_induk: uniqueNoInduk,
    level_id: '2',
    level_nama: 'Mahasiswa'
};

// Nonaktifkan animasi & preloader
test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({
        'X-Requested-With': 'XMLHttpRequest'
    });

    await page.addStyleTag({
        content: `
            #preloader, .loader { display:none !important; opacity:0!important; }
            *, *::before, *::after { animation: none !important; transition: none !important; }
        `
    });

    page.setDefaultTimeout(60000);
});

// ==========================================================================
// Helper: Search baris user
// ==========================================================================
async function searchAndFindUserRow(page, textToFind) {
    const searchBox = page.locator('input[aria-controls="table_user"]');
    await expect(searchBox).toBeVisible();
    await searchBox.fill(textToFind);

    await page.waitForLoadState('networkidle');

    const rowLocator = page.locator(`#table_user tbody tr:has-text("${textToFind}")`);
    await expect(rowLocator).toBeVisible({ timeout: 20000 });

    return rowLocator;
}

// ==========================================================================
// Helper: Login
// ==========================================================================
async function loginAsAdmin(page) {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
    await page.fill('#username', adminUser.username);
    await page.fill('#password', adminUser.password);

    await page.click('button[type="submit"]');

    await expect(page.locator('.swal2-title')).toHaveText(/Login Berhasil/i, { timeout: 10000 });
    await expect(page.locator('#swal2-container')).toBeHidden({ timeout: 5000 });
    await expect(page).toHaveURL(dashboardUrl, { timeout: 5000 });

    await page.goto(manageUserUrl, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle("Halaman Index - Modul");

    await page.waitForSelector('#table_user tbody tr', { state: 'visible', timeout: 15000 });
}

// ==========================================================================
// TEST SUITE — Hanya Filter & Tambah User
// ==========================================================================
test.describe('Kelola Pengguna', () => {

    test.describe.configure({ mode: 'serial' });

    test.use({ viewport: { width: 1400, height: 900 } });

    // 1. Akses Halaman & Filter
    test('1. Akses Halaman & Filter Data User', async ({ page }) => {
        await loginAsAdmin(page);

        await expect(page.locator('h4.header-title')).toHaveText(/Daftar User/i);

        const filterSelect = page.locator('#level_id');
        await filterSelect.selectOption({ label: 'Mahasiswa' });
        await page.waitForLoadState('networkidle');

        const firstRowLevel = await page.locator('#table_user tbody tr:first-child td')
            .nth(4)
            .innerText();

        expect(firstRowLevel).toMatch(/Mahasiswa|Administrator|Dosen|Teknisi|Sarana Prasarana/i);
    });

    // 2. Tambah User
    test('2. Tambah User Baru', async ({ page }) => {
        await loginAsAdmin(page);

        await page.click('button:has-text("Tambah User")');

        const modal = page.locator('#myModal');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.modal-header .modal-title')).toHaveText('Tambah User Baru');

        await modal.locator('form #level_id').selectOption({ label: 'Mahasiswa' });
        await modal.locator('form #username').fill(testUser.username);
        await modal.locator('form #password').fill(testUser.password);
        await modal.locator('form #nama').fill(testUser.nama);
        await modal.locator('form #no_induk').fill(testUser.no_induk);

        await modal.locator('button:has-text("Simpan")').click();

        await expect(page.locator('.swal2-title')).toHaveText(/Berhasil/i, { timeout: 10000 });
        await expect(page.locator('.swal2-html-container')).toHaveText(/User berhasil ditambahkan/i);

        await page.waitForLoadState('networkidle');

        const tableRow = await searchAndFindUserRow(page, testUser.username);
        await expect(tableRow).toBeVisible();
    });

    // 3. Lihat Detail User
    test('3. Lihat Detail User', async ({ page }) => {
        await loginAsAdmin(page);

        // Cari user yang sudah dibuat
        const row = await searchAndFindUserRow(page, testUser.username);

        // Cari tombol detail
        const btnDetail = row.getByRole('button', { name: 'Detail' });
        await btnDetail.click();


        // Modal muncul
        const modal = page.locator('#myModal');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.modal-title')).toHaveText(/Detail User/i);

        // Validasi field di modal
        await expect(modal.locator('input[readonly]').nth(1)).toHaveValue(testUser.username);
        await expect(modal.locator('input[readonly]').nth(2)).toHaveValue(testUser.no_induk);
        await expect(modal.locator('input[readonly]').nth(3)).toHaveValue(testUser.nama);

        // Validasi level (opsional, tergantung text)
        await expect(modal.locator('input[readonly]').nth(4)).toHaveValue(/Mahasiswa/i);

        // Tutup modal
        await modal.locator('button:has-text("Tutup")').click();
        await expect(modal).toBeHidden({ timeout: 5000 });
    });


        // 4. Edit User
    test('4. Edit User', async ({ page }) => {
        await loginAsAdmin(page);

        // Cari user yang sudah dibuat sebelumnya
        const row = await searchAndFindUserRow(page, testUser.username);

        // Klik tombol Edit
        const btnEdit = row.getByRole('button', { name: 'Edit' });
        await btnEdit.click();

        // Modal tampil
        const modal = page.locator('#myModal');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.modal-title')).toHaveText(/Edit User/i);

        // Edit beberapa data user
        const newNama = 'User Test Playwright Updated';
        const newNoInduk = testUser.no_induk + '1';  // Tambahkan angka di belakang
        const newPassword = 'passwordBaru123';

        await modal.locator('form #nama').fill(newNama);
        await modal.locator('form #no_induk').fill(newNoInduk);
        await modal.locator('form #password').fill(newPassword);

        // Ganti Level ke Dosen (opsional)
        await modal.locator('form #level_id').selectOption({ label: 'Dosen' });

        // Submit update
        await modal.locator('button:has-text("Update")').click();

        // Validasi notifikasi sukses
        await expect(page.locator('.swal2-title')).toHaveText(/Berhasil/i);
        await expect(page.locator('.swal2-html-container')).toContainText(/berhasil diperbarui|update/i);

        // Update data user di variabel supaya bisa dipakai test lain
        testUser.nama = newNama;
        testUser.no_induk = newNoInduk;
        testUser.password = newPassword;
        testUser.level_nama = 'Dosen';

        // Re-check di tabel
        await page.waitForLoadState('networkidle');

        const updatedRow = await searchAndFindUserRow(page, testUser.username);

        await expect(updatedRow.locator('td').nth(2)).toHaveText(newNoInduk); // No Induk
        await expect(updatedRow.locator('td').nth(3)).toHaveText(newNama);    // Nama
        await expect(updatedRow.locator('td').nth(4)).toHaveText(/Dosen/i);   // Level
    });

        // 5. Hapus User
    test('5. Hapus User', async ({ page }) => {
        await loginAsAdmin(page);

        // Cari user berdasarkan username
        const row = await searchAndFindUserRow(page, testUser.username);

        // Klik tombol Hapus
        const btnHapus = row.getByRole('button', { name: 'Hapus' });
        await btnHapus.click();

        // Modal tampil
        const modal = page.locator('#myModal');
        await expect(modal).toBeVisible();
        await expect(modal.locator('.modal-title')).toHaveText(/Konfirmasi Hapus/i);

        // Klik tombol konfirmasi hapus
        await modal.locator('button:has-text("Hapus")').click();

        // Validasi SweetAlert sukses
        await expect(page.locator('.swal2-title')).toHaveText(/Berhasil/i, { timeout: 10000 });
        await expect(page.locator('.swal2-html-container')).toHaveText(/berhasil dihapus/i);

        // Reload DataTable
        await page.waitForLoadState('networkidle');

        // Cari ulang user → seharusnya TIDAK ADA
        const searchBox = page.locator('input[aria-controls="table_user"]');
        await searchBox.fill(testUser.username);
        await page.waitForTimeout(1500);

        // Baris tabel kosong setelah dihapus
        const emptyRow = page.locator('#table_user tbody tr td.dataTables_empty');
        await expect(emptyRow).toBeVisible({ timeout: 5000 });
    });


});
