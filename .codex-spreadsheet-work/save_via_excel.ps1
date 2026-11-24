$ErrorActionPreference = 'Stop'

$targetPath = 'C:\Users\jerom\Downloads\IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx'
$sourcePath = 'C:\Users\jerom\Downloads\ZenTra-Web\.codex-spreadsheet-work\IAS-Test-Cases-Progress-Tracker-ZenTra.updated.xlsx'

$excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
$targetWorkbook = $null

foreach ($workbook in @($excel.Workbooks)) {
    if ([string]::Equals($workbook.FullName, $targetPath, [StringComparison]::OrdinalIgnoreCase)) {
        $targetWorkbook = $workbook
        break
    }
}

if ($null -eq $targetWorkbook) {
    throw "Target workbook is not open in the active Excel session."
}

$sourceWorkbook = $excel.Workbooks.Open($sourcePath, $false, $true)

try {
    $sourceSheet = $sourceWorkbook.Worksheets.Item('Test Cases (Web)')
    $targetSheet = $targetWorkbook.Worksheets.Item('Test Cases (Web)')

    $sourceRange = $sourceSheet.Range('A1:I66')
    $targetRange = $targetSheet.Range('A1:I66')

    $sourceRange.Copy()
    $targetRange.PasteSpecial(-4104)
    $excel.CutCopyMode = $false

    for ($row = 42; $row -le 66; $row++) {
        $targetSheet.Rows.Item($row).RowHeight = $sourceSheet.Rows.Item($row).RowHeight
    }
    $targetSheet.Rows('11:66').AutoFit()

    $targetSheet.Range('H5').Value2 = 55
    $targetSheet.Range('H6').Value2 = 55
    $targetSheet.Range('H7').Value2 = 0
    $targetSheet.Range('I6').Value2 = 1

    $count = 0
    for ($row = 11; $row -le 66; $row++) {
        $value = [string]$targetSheet.Cells.Item($row, 1).Value2
        if ($value -match '^ID-\d{3}$') {
            $count++
        }
    }

    if ($count -ne 55) {
        throw "Expected 55 web test cases in Excel after paste, found $count."
    }

    $targetWorkbook.Save()
    "SAVED_IN_EXCEL $targetPath"
    "WEB_TEST_CASE_COUNT $count"
    "PROJECT_NAME $($targetSheet.Range('B4').Value2)"
    "TOTAL $($targetSheet.Range('H5').Value2)"
    "PASS $($targetSheet.Range('H6').Value2)"
    "FAIL $($targetSheet.Range('H7').Value2)"
}
finally {
    if ($null -ne $sourceWorkbook) {
        $sourceWorkbook.Close($false)
    }
}
