# Physical print and scan test record

The generated A4 PDF passed automated size and visual checks on 2026-08-11. Physical validation still requires printers and scanners.

Use at least two printer classes:

| Printer class | Suggested start | Paper/scale | Record |
| --- | --- | --- | --- |
| Office laser or inkjet | Code 128 scale 3; PDF417 scale 3, error level 2 | A4, 100%, no fit-to-page | Printer model, DPI, paper, scan distance, 10/10 result |
| Thermal label printer | Start at native driver size; keep quiet zones | Matching stock, 100% | Printer model, stock dimensions, darkness/speed, 10/10 result |

For each format, print ten different values. Scan every label with the production scanner or phone used in the actual workflow. Record failures, reprint after changing only one parameter, and keep the lowest-density settings that achieve 10/10 scans.

Do not mark physical print acceptance complete from a browser preview or software decoder alone.
