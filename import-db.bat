@echo off
REM ============================================================
REM Impor asmorobangun.sql ke MySQL XAMPP.
REM PERINGATAN: database asmorobangun yang lama akan DIHAPUS.
REM Taruh asmorobangun.sql di folder yang sama dengan file ini,
REM lalu klik dua kali. MySQL harus sudah Start.
REM ============================================================
set MYSQL_BIN=C:\xampp\mysql\bin
set DB_NAME=asmorobangun
set DB_USER=root
REM Isi DB_PASS kalau MySQL kamu memakai password (kosongkan kalau tidak)
set DB_PASS=

if not exist asmorobangun.sql (
  echo File asmorobangun.sql tidak ditemukan di folder ini.
  pause
  exit /b 1
)

echo PERINGATAN: database %DB_NAME% yang ada sekarang akan DIHAPUS dan diganti isi asmorobangun.sql.
set /p OK=Ketik YA lalu Enter untuk lanjut: 
if /i not "%OK%"=="YA" (
  echo Dibatalkan.
  pause
  exit /b 0
)

set PASS_ARG=
if not "%DB_PASS%"=="" set PASS_ARG=-p%DB_PASS%

"%MYSQL_BIN%\mysql.exe" -u %DB_USER% %PASS_ARG% -e "DROP DATABASE IF EXISTS %DB_NAME%; CREATE DATABASE %DB_NAME% CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
if errorlevel 1 goto gagal

"%MYSQL_BIN%\mysql.exe" -u %DB_USER% %PASS_ARG% %DB_NAME% -e "source asmorobangun.sql"
if errorlevel 1 goto gagal

echo.
echo Berhasil! Sekarang jalankan backend: npm start
pause
exit /b 0

:gagal
echo.
echo GAGAL. Pastikan MySQL di XAMPP sudah Start, max_allowed_packet sudah 32M, dan folder XAMPP benar.
pause
exit /b 1