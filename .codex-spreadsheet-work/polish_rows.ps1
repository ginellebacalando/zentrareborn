$ErrorActionPreference = 'Stop'
$targetPath = 'C:\Users\jerom\Downloads\IAS-Test-Cases-Progress-Tracker-ZenTra.xlsx'
$excel = [Runtime.InteropServices.Marshal]::GetActiveObject('Excel.Application')
$targetWorkbook = $null
foreach ($workbook in @($excel.Workbooks)) {
    if ([string]::Equals($workbook.FullName, $targetPath, [StringComparison]::OrdinalIgnoreCase)) {
        $targetWorkbook = $workbook
        break
    }
}
if ($null -eq $targetWorkbook) { throw 'Target workbook is not open in Excel.' }
$sheet = $targetWorkbook.Worksheets.Item('Test Cases (Web)')
$sheet.Rows('42:66').RowHeight = 45
$targetWorkbook.Save()
'SAVED_ROW_HEIGHTS 42:66'
