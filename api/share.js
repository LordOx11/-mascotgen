// 🐦 THE SHARE CARD — Vercel function #10 of 12.
//
// ONE function, TWO jobs, because the SPA cannot do either:
//   1. /s/<id>            → a tiny HTML page whose ONLY purpose is carrying
//      per-mascot OpenGraph/Twitter tags. X's crawler runs no JavaScript, so
//      the React app is invisible to it — this page is what the crawler sees.
//      A human who clicks a CHAPTER link now READS THE CHAPTER here: title,
//      art, prose, and one quiet line about the world. No wallet, no token,
//      no redirect — so a chapter link can be posted anywhere, including
//      communities that would bounce anything crypto-shaped on sight.
//   2. /api/share?id&img=1 → the 1200×630 card PNG itself, drawn fresh on
//      every request. The chapter count is queried LIVE from
//      published_chapters — the card can never go stale, because nothing is
//      ever stored. That count is the whole point of the card: it proves the
//      character has a history.
//
// X caches a link's card for up to ~a week and there is no reliable manual
// refresh. The app handles that upstream: share links carry ?v=<chapterCount>,
// so the URL — and therefore the cache key — changes exactly when the story
// grows. Old tweets keep the card from their era, which is correct.
//
// The font is a 9KB ASCII subset of DejaVu Sans Mono Bold embedded below —
// no runtime font fetch, no extra file for the deploy to lose.
//
// Requires: SUPABASE_URL, SUPABASE_SERVICE_KEY. Optional: X_HANDLE (e.g.
// "@mascotgen") for twitter:site. Dependency: @resvg/resvg-js (package.json).

import { Resvg } from "@resvg/resvg-js";
import { computeStats } from "../src/stats.js";

// 🔤 TEXT AS GEOMETRY. Production resvg builds ignored our font buffer —
// every rect drew, every letter vanished (the "black card" bug). So the card
// no longer uses fonts AT ALL: each character of DejaVu Sans Mono Bold was
// pre-extracted as a raw SVG path at build time, and T() lays the paths out
// by hand (monospace: fixed advance, so layout is arithmetic). Nothing about
// text rendering can now differ between any two machines, ever.
const GLYPHS = {"upm":2048,"adv":1233,"g":{" ":"","!":"M483 283H750V0H483ZM483 1493H750V838L717 481H518L483 838Z","\"":"M999 1493V938H743V1493ZM487 1493V938H231V1493Z","#":"M707 1470 612 1096H815L909 1470H1133L1036 1096H1229V881H983L909 588H1114V373H856L762 0H541L635 373H430L336 0H115L209 373H2V588H262L336 881H117V1096H391L485 1470ZM762 881H557L483 588H688Z","$":"M694 528V226Q757 235 792.0 274.5Q827 314 827 375Q827 437 792.5 476.5Q758 516 694 528ZM553 817V1100Q491 1092 459.5 1058.5Q428 1025 428 967Q428 910 459.5 872.0Q491 834 553 817ZM694 -301H553L552 0Q465 3 370.0 26.0Q275 49 172 92V354Q275 293 371.5 260.0Q468 227 553 226V555Q356 594 260.0 689.5Q164 785 164 942Q164 1109 266.0 1208.0Q368 1307 553 1319V1556H694L695 1319Q766 1315 842.5 1301.0Q919 1287 999 1262V1006Q937 1046 861.0 1070.0Q785 1094 694 1100V793Q891 762 991.5 658.5Q1092 555 1092 383Q1092 219 983.5 114.0Q875 9 695 0Z","%":"M33 1112Q33 1246 126.0 1339.0Q219 1432 352 1432Q485 1432 578.5 1338.5Q672 1245 672 1112Q672 979 578.5 886.0Q485 793 352 793Q219 793 126.0 885.5Q33 978 33 1112ZM352 1249Q295 1249 255.0 1209.5Q215 1170 215 1112Q215 1054 255.0 1014.5Q295 975 352 975Q410 975 449.5 1014.5Q489 1054 489 1112Q489 1169 449.0 1209.0Q409 1249 352 1249ZM86 561 1128 979 1169 883 121 465ZM580 319Q580 453 672.5 546.0Q765 639 899 639Q1031 639 1125.0 545.5Q1219 452 1219 319Q1219 187 1125.0 93.5Q1031 0 899 0Q765 0 672.5 92.5Q580 185 580 319ZM897 457Q841 457 801.5 417.0Q762 377 762 319Q762 261 801.0 221.5Q840 182 897 182Q955 182 995.5 222.0Q1036 262 1036 319Q1036 376 995.0 416.5Q954 457 897 457Z","&":"M870 72Q795 22 710.5 -3.5Q626 -29 539 -29Q315 -29 176.0 102.0Q37 233 37 442Q37 587 107.5 706.0Q178 825 317 913Q267 991 243.0 1057.5Q219 1124 219 1184Q219 1346 328.0 1433.0Q437 1520 643 1520Q716 1520 786.0 1509.0Q856 1498 924 1477V1221Q860 1257 794.5 1275.5Q729 1294 664 1294Q584 1294 543.0 1266.0Q502 1238 502 1184Q502 1148 532.5 1085.0Q563 1022 631 920L944 440Q965 478 976.0 527.0Q987 576 987 633Q987 663 985.0 691.5Q983 720 979 745H1214V694Q1214 549 1180.0 440.5Q1146 332 1073 246L1235 0H918ZM440 731Q374 688 340.5 628.5Q307 569 307 496Q307 374 385.5 290.5Q464 207 578 207Q606 207 635.5 213.5Q665 220 693 232Q695 233 701 236Q730 250 748 262Z","'":"M743 1493V938H487V1493Z","(":"M924 1554Q792 1315 728.0 1091.0Q664 867 664 643Q664 421 728.0 195.5Q792 -30 924 -270H696Q537 -39 460.0 185.5Q383 410 383 643Q383 875 460.5 1100.5Q538 1326 696 1554Z",")":"M309 1554H537Q695 1326 772.5 1100.5Q850 875 850 643Q850 410 773.0 185.5Q696 -39 537 -270H309Q441 -30 505.0 195.5Q569 421 569 643Q569 867 505.0 1091.0Q441 1315 309 1554Z","*":"M1108 1217 778 1044 1108 870 1032 729 700 913V569H528V913L197 729L121 870L453 1044L121 1217L197 1358L528 1176V1520H700V1176L1032 1358Z","+":"M735 1192V762H1165V524H735V92H498V524H66V762H498V1192Z",",":"M461 367H774V96L578 -287H362L461 96Z","-":"M301 735H932V444H301Z",".":"M449 367H782V0H449Z","/":"M899 1493H1120L334 -190H113Z","0":"M492 745Q492 798 528.0 834.0Q564 870 616 870Q669 870 705.0 834.0Q741 798 741 745Q741 693 705.0 657.0Q669 621 616 621Q564 621 528.0 656.5Q492 692 492 745ZM616 1270Q514 1270 467.0 1145.0Q420 1020 420 745Q420 471 467.0 346.0Q514 221 616 221Q719 221 766.0 346.0Q813 471 813 745Q813 1020 766.0 1145.0Q719 1270 616 1270ZM123 745Q123 1133 246.0 1326.5Q369 1520 616 1520Q864 1520 987.0 1327.0Q1110 1134 1110 745Q1110 357 987.0 164.0Q864 -29 616 -29Q369 -29 246.0 164.5Q123 358 123 745Z","1":"M188 260H518V1229L211 1153V1419L520 1493H805V260H1135V0H188Z","2":"M434 260H1063V0H115V252L275 422Q560 725 621 795Q696 881 729.0 947.5Q762 1014 762 1079Q762 1179 701.5 1233.5Q641 1288 530 1288Q451 1288 352.5 1256.5Q254 1225 147 1165V1440Q254 1479 356.5 1499.5Q459 1520 553 1520Q790 1520 925.5 1409.5Q1061 1299 1061 1108Q1061 1020 1031.5 943.0Q1002 866 930 772Q877 704 639 466Q510 337 434 260Z","3":"M549 668H391V928H549Q659 928 719.5 971.5Q780 1015 780 1094Q780 1177 719.5 1223.5Q659 1270 549 1270Q465 1270 369.0 1249.0Q273 1228 170 1188V1456Q273 1487 373.0 1503.5Q473 1520 565 1520Q801 1520 933.0 1417.0Q1065 1314 1065 1133Q1065 1000 989.0 915.5Q913 831 772 805Q932 777 1016.0 677.5Q1100 578 1100 416Q1100 199 961.0 85.0Q822 -29 557 -29Q444 -29 334.5 -10.0Q225 9 125 45V319Q219 272 328.0 247.5Q437 223 557 223Q677 223 747.0 278.5Q817 334 817 428Q817 543 747.0 605.5Q677 668 549 668Z","4":"M694 1165 317 575H694ZM668 1493H977V575H1141V322H977V0H694V322H102V608Z","5":"M193 1493H1004V1233H432V956Q468 970 509.0 976.5Q550 983 596 983Q818 983 956.0 843.0Q1094 703 1094 479Q1094 244 944.5 107.5Q795 -29 537 -29Q441 -29 343.0 -13.0Q245 3 143 35V301Q226 260 313.5 239.5Q401 219 489 219Q645 219 726.0 285.5Q807 352 807 479Q807 596 726.5 666.5Q646 737 512 737Q433 737 353.5 717.5Q274 698 193 659Z","6":"M643 748Q547 748 496.5 678.5Q446 609 446 477Q446 346 496.5 276.5Q547 207 643 207Q739 207 790.5 276.5Q842 346 842 477Q842 608 790.5 678.0Q739 748 643 748ZM1030 1458V1190Q951 1235 878.5 1257.5Q806 1280 739 1280Q579 1280 495.5 1172.5Q412 1065 408 855Q455 920 528.0 952.5Q601 985 700 985Q902 985 1012.0 857.5Q1122 730 1122 496Q1122 245 998.5 107.0Q875 -31 651 -31Q378 -31 254.5 152.0Q131 335 131 743Q131 1131 282.0 1324.5Q433 1518 735 1518Q805 1518 879.5 1503.0Q954 1488 1030 1458Z","7":"M135 1493H1079V1284L573 0H272L758 1233H135Z","8":"M616 666Q517 666 456.0 603.5Q395 541 395 438Q395 335 456.0 272.0Q517 209 616 209Q715 209 776.5 273.0Q838 337 838 438Q838 541 777.0 603.5Q716 666 616 666ZM397 791Q284 830 225.0 913.5Q166 997 166 1118Q166 1304 287.0 1412.0Q408 1520 616 1520Q825 1520 946.0 1412.0Q1067 1304 1067 1118Q1067 998 1009.0 914.5Q951 831 840 791Q964 753 1034.0 655.0Q1104 557 1104 420Q1104 205 977.0 88.0Q850 -29 616 -29Q383 -29 256.0 88.0Q129 205 129 420Q129 558 200.0 656.0Q271 754 397 791ZM428 1094Q428 1006 478.5 954.5Q529 903 616 903Q704 903 754.5 954.5Q805 1006 805 1094Q805 1181 754.5 1231.5Q704 1282 616 1282Q530 1282 479.0 1231.0Q428 1180 428 1094Z","9":"M203 20V289Q282 243 354.5 221.0Q427 199 494 199Q653 199 736.5 305.5Q820 412 825 624Q778 559 705.0 526.5Q632 494 532 494Q331 494 221.0 621.5Q111 749 111 983Q111 1233 234.0 1370.0Q357 1507 582 1507Q855 1507 978.5 1324.5Q1102 1142 1102 735Q1102 348 951.0 154.5Q800 -39 498 -39Q428 -39 353.5 -24.0Q279 -9 203 20ZM590 741Q685 741 735.5 810.5Q786 880 786 1012Q786 1143 735.5 1212.5Q685 1282 590 1282Q494 1282 442.5 1212.5Q391 1143 391 1012Q391 881 442.5 811.0Q494 741 590 741Z",":":"M449 1063H782V698H449ZM449 367H782V0H449Z",";":"M449 367H782V96L586 -287H371L449 96ZM449 1063H782V698H449Z","<":"M1145 926 350 641 1145 358V109L88 524V760L1145 1176Z","=":"M88 532H1145V295H88ZM88 987H1145V752H88Z",">":"M88 926V1176L1145 760V524L88 109V358L883 641Z","?":"M440 283H707V0H440ZM707 401H440V555Q440 654 471.0 724.0Q502 794 582 872L672 961Q735 1022 757.5 1062.0Q780 1102 780 1145Q780 1212 734.0 1246.0Q688 1280 596 1280Q512 1280 420.5 1244.5Q329 1209 233 1139V1407Q331 1463 431.5 1491.5Q532 1520 633 1520Q835 1520 950.0 1426.0Q1065 1332 1065 1167Q1065 1091 1031.0 1025.5Q997 960 903 868L815 782Q747 716 728.0 674.0Q709 632 709 571Q709 562 708.5 550.0Q708 538 707 524Z","@":"M973 545Q973 658 922.0 722.0Q871 786 782 786Q693 786 642.5 722.0Q592 658 592 545Q592 431 642.5 367.0Q693 303 782 303Q871 303 922.0 367.0Q973 431 973 545ZM1159 135H963V217Q925 164 873.5 139.5Q822 115 750 115Q586 115 485.5 233.0Q385 351 385 545Q385 738 485.0 855.5Q585 973 750 973Q821 973 875.0 948.5Q929 924 963 877V918Q963 1054 888.5 1128.0Q814 1202 676 1202Q468 1202 336.5 1019.0Q205 836 205 543Q205 236 357.0 54.5Q509 -127 762 -127Q842 -127 917.0 -103.5Q992 -80 1061 -33L1153 -209Q1072 -264 976.5 -291.5Q881 -319 772 -319Q422 -319 214.0 -86.0Q6 147 6 543Q6 930 193.0 1162.5Q380 1395 688 1395Q906 1395 1032.5 1263.5Q1159 1132 1159 905Z","A":"M616 1223 477 612H756ZM436 1493H797L1200 0H905L813 369H418L328 0H33Z","B":"M410 678V236H606Q747 236 803.5 284.0Q860 332 860 451Q860 572 801.0 625.0Q742 678 606 678ZM410 1260V913H606Q718 913 765.5 953.0Q813 993 813 1085Q813 1177 764.5 1218.5Q716 1260 606 1260ZM125 1495H606Q855 1495 980.5 1400.5Q1106 1306 1106 1118Q1106 974 1032.0 893.0Q958 812 815 799Q986 782 1072.5 684.0Q1159 586 1159 410Q1159 194 1029.0 97.0Q899 0 606 0H125Z","C":"M1081 43Q1011 7 934.0 -11.0Q857 -29 772 -29Q470 -29 311.0 170.0Q152 369 152 745Q152 1122 311.0 1321.0Q470 1520 772 1520Q857 1520 935.0 1502.0Q1013 1484 1081 1448V1120Q1005 1190 933.5 1222.5Q862 1255 786 1255Q624 1255 541.5 1126.5Q459 998 459 745Q459 493 541.5 364.5Q624 236 786 236Q862 236 933.5 268.5Q1005 301 1081 371Z","D":"M432 1227V266H512Q686 266 760.0 375.5Q834 485 834 748Q834 1009 760.0 1118.0Q686 1227 512 1227ZM137 1493H453Q819 1493 980.0 1318.5Q1141 1144 1141 748Q1141 351 980.0 175.5Q819 0 453 0H137Z","E":"M1098 0H168V1493H1098V1233H463V911H1038V651H463V260H1098Z","F":"M1112 1233H477V911H1055V651H477V0H182V1493H1112Z","G":"M872 270V555H670V803H1130V119Q1045 46 942.5 8.5Q840 -29 723 -29Q433 -29 275.0 172.5Q117 374 117 745Q117 1122 276.5 1321.0Q436 1520 737 1520Q827 1520 914.0 1494.5Q1001 1469 1077 1421V1094Q1015 1174 934.5 1214.5Q854 1255 758 1255Q590 1255 507.0 1128.5Q424 1002 424 745Q424 496 504.0 366.0Q584 236 737 236Q783 236 817.0 244.5Q851 253 872 270Z","H":"M137 1493H432V924H801V1493H1096V0H801V664H432V0H137Z","I":"M172 1233V1493H1061V1233H764V260H1061V0H172V260H469V1233Z","J":"M109 74V416Q195 328 292.5 282.0Q390 236 489 236Q605 236 659.0 294.0Q713 352 713 479V1233H352V1493H1008V479Q1008 206 893.5 88.5Q779 -29 516 -29Q421 -29 317.5 -3.0Q214 23 109 74Z","K":"M117 1493H412V903L874 1493H1208L737 905L1225 0H897L543 672L412 506V0H117Z","L":"M225 0V1493H520V260H1151V0Z","M":"M86 1493H438L616 838L793 1493H1147V0H893V1196L735 543H500L340 1196V0H86Z","N":"M119 1493H436L852 408V1493H1112V0H797L379 1085V0H119Z","O":"M616 1255Q503 1255 451.0 1134.5Q399 1014 399 745Q399 477 451.0 356.5Q503 236 616 236Q730 236 782.0 356.5Q834 477 834 745Q834 1014 782.0 1134.5Q730 1255 616 1255ZM92 745Q92 1128 224.5 1324.0Q357 1520 616 1520Q876 1520 1008.5 1324.0Q1141 1128 1141 745Q1141 363 1008.5 167.0Q876 -29 616 -29Q357 -29 224.5 167.0Q92 363 92 745Z","P":"M457 1245V807H578Q723 807 781.5 856.0Q840 905 840 1026Q840 1147 781.5 1196.0Q723 1245 578 1245ZM162 1493H567Q876 1493 1011.5 1383.0Q1147 1273 1147 1026Q1147 779 1011.5 669.0Q876 559 567 559H457V0H162Z","Q":"M656 -23Q642 -26 632.5 -27.5Q623 -29 614 -29Q357 -29 224.5 167.0Q92 363 92 745Q92 1128 224.5 1324.0Q357 1520 616 1520Q876 1520 1008.5 1324.0Q1141 1128 1141 745Q1141 482 1078.0 304.5Q1015 127 895 51L1081 -131L879 -281ZM616 1255Q503 1255 451.0 1134.5Q399 1014 399 745Q399 477 451.0 356.5Q503 236 616 236Q730 236 782.0 356.5Q834 477 834 745Q834 1014 782.0 1134.5Q730 1255 616 1255Z","R":"M807 705Q851 696 883.5 663.5Q916 631 963 537L1233 0H909L729 377Q721 393 708 421Q629 590 522 590H428V0H133V1493H559Q847 1493 972.5 1391.0Q1098 1289 1098 1059Q1098 905 1023.0 814.0Q948 723 807 705ZM428 1245V838H567Q688 838 740.5 885.5Q793 933 793 1042Q793 1151 741.0 1198.0Q689 1245 567 1245Z","S":"M510 655Q287 740 208.0 833.5Q129 927 129 1085Q129 1288 259.0 1404.0Q389 1520 616 1520Q719 1520 822.0 1496.5Q925 1473 1026 1427V1139Q931 1206 833.0 1241.0Q735 1276 639 1276Q532 1276 475.0 1233.0Q418 1190 418 1110Q418 1048 459.5 1007.5Q501 967 633 918L760 870Q940 804 1025.0 695.0Q1110 586 1110 420Q1110 194 976.5 82.5Q843 -29 573 -29Q462 -29 350.5 -2.5Q239 24 135 76V381Q253 297 363.5 256.0Q474 215 582 215Q691 215 751.0 264.5Q811 314 811 403Q811 470 771.0 520.5Q731 571 655 600Z","T":"M764 0H469V1235H90V1493H1143V1235H764Z","U":"M106 551V1493H401V477Q401 365 458.0 301.5Q515 238 616 238Q717 238 774.0 301.5Q831 365 831 477V1493H1126V551Q1126 247 1005.0 109.0Q884 -29 616 -29Q349 -29 227.5 109.0Q106 247 106 551Z","V":"M616 246 879 1493H1176L821 0H412L57 1493H354Z","W":"M0 1493H258L365 397L494 1106H739L889 397L973 1493H1233L1061 0H786L616 784L457 0H184Z","X":"M1206 0H901L616 494L332 0H27L465 758L39 1493H344L616 1018L889 1493H1194L770 758Z","Y":"M8 1493H326L616 893L907 1493H1225L764 588V0H469V588Z","Z":"M137 1493H1147V1249L455 260H1161V0H115V244L786 1233H137Z","[":"M422 1556H930V1366H688V-80H930V-270H422Z","\\":"M334 1493 1120 -190H897L111 1493Z","]":"M811 1556V-270H303V-80H545V1366H303V1556Z","^":"M739 1493 1176 936H934L616 1237L299 936H57L494 1493Z","_":"M1233 -293V-483H0V-293Z","`":"M481 1638 764 1262H567L199 1638Z","a":"M700 526Q536 526 471.0 484.0Q406 442 406 340Q406 264 451.0 219.0Q496 174 573 174Q689 174 753.0 261.5Q817 349 817 506V526ZM1108 639V0H817V125Q764 51 681.0 11.0Q598 -29 498 -29Q307 -29 200.5 72.0Q94 173 94 354Q94 550 221.0 643.5Q348 737 614 737H817V786Q817 857 765.5 893.5Q714 930 614 930Q509 930 410.5 903.5Q312 877 205 819V1069Q302 1109 402.0 1128.0Q502 1147 614 1147Q887 1147 997.5 1036.0Q1108 925 1108 639Z","b":"M850 557Q850 719 796.0 811.0Q742 903 647 903Q552 903 497.0 811.0Q442 719 442 557Q442 395 497.0 303.0Q552 211 647 211Q742 211 796.0 303.0Q850 395 850 557ZM442 961Q496 1054 567.5 1100.5Q639 1147 729 1147Q928 1147 1035.5 995.0Q1143 843 1143 559Q1143 279 1037.0 125.0Q931 -29 739 -29Q638 -29 563.0 20.0Q488 69 442 166V0H150V1556H442Z","c":"M1061 57Q987 14 902.0 -7.5Q817 -29 719 -29Q460 -29 314.0 127.0Q168 283 168 559Q168 836 315.0 992.5Q462 1149 721 1149Q811 1149 894.5 1128.0Q978 1107 1061 1063V795Q997 850 920.5 879.5Q844 909 762 909Q619 909 542.0 818.0Q465 727 465 559Q465 391 542.0 301.0Q619 211 762 211Q847 211 921.0 239.5Q995 268 1061 326Z","d":"M791 961V1556H1083V0H791V166Q744 69 669.5 20.0Q595 -29 494 -29Q302 -29 196.0 125.0Q90 279 90 559Q90 843 197.5 995.0Q305 1147 504 1147Q594 1147 665.5 1100.5Q737 1054 791 961ZM383 557Q383 395 437.0 303.0Q491 211 586 211Q681 211 736.0 303.0Q791 395 791 557Q791 719 736.0 811.0Q681 903 586 903Q491 903 437.0 811.0Q383 719 383 557Z","e":"M1102 55Q1000 13 894.0 -8.0Q788 -29 670 -29Q389 -29 240.5 121.5Q92 272 92 555Q92 829 235.0 988.0Q378 1147 625 1147Q874 1147 1011.5 999.5Q1149 852 1149 584V465H390Q391 333 468.0 268.0Q545 203 698 203Q799 203 897.0 232.0Q995 261 1102 324ZM854 685Q852 801 794.5 860.5Q737 920 625 920Q524 920 464.0 858.5Q404 797 393 684Z","f":"M739 1218V1120H1083V895H739V0H446V895H174V1120H446V1198Q446 1400 530.0 1478.0Q614 1556 842 1556H1083V1331H854Q788 1331 764.5 1307.0Q741 1283 739 1218Z","g":"M803 578Q803 728 746.0 818.5Q689 909 596 909Q504 909 447.5 819.0Q391 729 391 578Q391 426 447.5 336.0Q504 246 596 246Q689 246 746.0 336.5Q803 427 803 578ZM1096 84Q1096 -185 974.5 -304.5Q853 -424 580 -424Q488 -424 398.0 -410.5Q308 -397 215 -369V-100Q298 -146 384.0 -168.0Q470 -190 561 -190Q685 -190 744.0 -131.5Q803 -73 803 51V172Q760 92 689.0 53.0Q618 14 516 14Q324 14 211.0 164.0Q98 314 98 571Q98 837 211.0 993.0Q324 1149 514 1149Q610 1149 685.0 1104.0Q760 1059 803 977V1120H1096Z","h":"M1071 727V0H780V682Q780 803 745.5 855.0Q711 907 633 907Q553 907 508.0 836.5Q463 766 463 641V0H172V1556H463V952Q494 1045 569.0 1096.0Q644 1147 750 1147Q909 1147 990.0 1041.5Q1071 936 1071 727Z","i":"M221 1120H801V225H1165V0H143V225H508V895H221ZM508 1665H801V1323H508Z","j":"M850 43Q850 -209 759.5 -316.5Q669 -424 459 -424H143V-199H377Q475 -199 516.0 -144.0Q557 -89 557 43V895H260V1120H850ZM850 1323H557V1665H850Z","k":"M174 1556H467V739L819 1120H1174L750 702L1198 0H874L567 524L467 428V0H174Z","l":"M387 467V1331H90V1556H680V467Q680 335 721.0 280.0Q762 225 860 225H1094V0H778Q569 0 478.0 108.0Q387 216 387 467Z","m":"M690 1008Q723 1079 774.0 1113.0Q825 1147 899 1147Q1044 1147 1099.5 1047.0Q1155 947 1155 631V0H915V719Q915 844 896.0 886.0Q877 928 827 928Q777 928 757.0 885.0Q737 842 737 719V0H500V719Q500 842 480.0 885.0Q460 928 410 928Q360 928 341.0 886.0Q322 844 322 719V0H82V1120H295V1004Q320 1070 375.0 1108.5Q430 1147 498 1147Q566 1147 622.0 1106.5Q678 1066 690 1008Z","n":"M1071 727V0H780V682Q780 804 745.5 856.5Q711 909 633 909Q554 909 508.5 838.0Q463 767 463 641V0H172V1120H463V952Q494 1045 569.0 1096.0Q644 1147 750 1147Q909 1147 990.0 1041.5Q1071 936 1071 727Z","o":"M616 909Q511 909 451.0 816.5Q391 724 391 559Q391 394 451.0 301.5Q511 209 616 209Q722 209 782.0 301.5Q842 394 842 559Q842 724 782.0 816.5Q722 909 616 909ZM98 559Q98 830 238.5 988.5Q379 1147 616 1147Q854 1147 994.5 988.5Q1135 830 1135 559Q1135 288 994.5 129.5Q854 -29 616 -29Q379 -29 238.5 129.5Q98 288 98 559Z","p":"M442 158V-426H150V1120H442V952Q488 1049 563.0 1098.0Q638 1147 739 1147Q931 1147 1037.0 993.0Q1143 839 1143 559Q1143 275 1035.5 123.0Q928 -29 729 -29Q639 -29 567.5 17.5Q496 64 442 158ZM850 561Q850 723 796.0 815.0Q742 907 647 907Q552 907 497.0 815.0Q442 723 442 561Q442 399 497.0 307.0Q552 215 647 215Q742 215 796.0 307.0Q850 399 850 561Z","q":"M383 561Q383 399 437.0 307.0Q491 215 586 215Q681 215 736.0 307.0Q791 399 791 561Q791 723 736.0 815.0Q681 907 586 907Q491 907 437.0 815.0Q383 723 383 561ZM791 158Q737 64 665.5 17.5Q594 -29 504 -29Q305 -29 197.5 123.0Q90 275 90 559Q90 839 196.0 993.0Q302 1147 494 1147Q595 1147 669.5 1098.0Q744 1049 791 952V1120H1083V-426H791Z","r":"M1151 811Q1103 855 1038.5 877.0Q974 899 897 899Q804 899 734.5 866.5Q665 834 627 772Q603 734 593.5 680.0Q584 626 584 516V0H291V1120H584V946Q627 1042 716.0 1094.5Q805 1147 924 1147Q984 1147 1041.5 1132.5Q1099 1118 1151 1090Z","s":"M991 1085V829Q910 881 822.5 907.5Q735 934 647 934Q549 934 499.0 905.5Q449 877 449 821Q449 741 663 691L674 688L758 668Q918 630 992.5 545.5Q1067 461 1067 317Q1067 144 953.5 57.5Q840 -29 612 -29Q511 -29 405.0 -11.5Q299 6 190 41V297Q287 242 387.5 213.0Q488 184 582 184Q685 184 738.0 214.0Q791 244 791 301Q791 357 753.5 387.0Q716 417 575 451L494 469Q326 507 249.0 588.0Q172 669 172 805Q172 967 289.0 1057.0Q406 1147 618 1147Q713 1147 807.5 1131.5Q902 1116 991 1085Z","t":"M690 1438V1120H1073V895H690V365Q690 290 726.5 257.5Q763 225 848 225H1073V0H827Q575 0 486.0 80.5Q397 161 397 379V895H111V1120H397V1438Z","u":"M160 391V1120H453V436Q453 315 487.0 263.0Q521 211 600 211Q679 211 723.5 281.0Q768 351 768 477V1120H1061V0H768V166Q737 73 662.5 22.0Q588 -29 483 -29Q323 -29 241.5 77.0Q160 183 160 391Z","v":"M1153 1120 797 0H436L80 1120H377L616 246L856 1120Z","w":"M0 1120H244L377 262L498 827H735L854 262L989 1120H1233L1030 0H752L616 582L481 0H203Z","x":"M1145 1120 768 584 1178 0H836L616 377L397 0H55L469 584L88 1120H430L616 786L803 1120Z","y":"M711 -121Q652 -279 569.5 -351.5Q487 -424 369 -424H127V-201H246Q336 -201 378.0 -170.5Q420 -140 463 -29L485 31L59 1120H367L623 393L868 1120H1176Z","z":"M186 1120H1081V891L492 219H1081V0H162V229L752 901H186Z","{":"M1053 -143V-334H903Q654 -334 569.5 -260.0Q485 -186 485 35V250Q485 401 431.5 458.5Q378 516 238 516H176V707H238Q378 707 431.5 764.0Q485 821 485 973V1188Q485 1409 569.5 1482.5Q654 1556 903 1556H1053V1366H930Q826 1366 791.0 1324.0Q756 1282 756 1139V930Q756 765 707.0 698.0Q658 631 532 612Q658 591 707.0 523.0Q756 455 756 291V86Q756 -58 791.0 -100.5Q826 -143 930 -143Z","|":"M729 1565V-483H502V1565Z","}":"M180 -143H301Q405 -143 441.0 -100.0Q477 -57 477 86V291Q477 455 526.0 523.0Q575 591 700 612Q574 631 525.5 698.0Q477 765 477 930V1139Q477 1280 441.5 1323.0Q406 1366 301 1366H180V1556H330Q578 1556 661.5 1482.5Q745 1409 745 1188V973Q745 822 799.5 764.5Q854 707 995 707H1057V516H995Q854 516 799.5 458.0Q745 400 745 250V35Q745 -186 661.5 -260.0Q578 -334 330 -334H180Z","~":"M1145 811V578Q1070 518 998.5 490.5Q927 463 848 463Q758 463 645 514Q623 524 612 528Q535 562 483.5 574.0Q432 586 381 586Q303 586 232.5 557.0Q162 528 88 465V694Q166 755 239.0 782.0Q312 809 395 809Q448 809 498.0 798.0Q548 787 622 756Q633 751 655 741Q771 686 864 686Q934 686 1003.0 716.5Q1072 747 1145 811Z","\u00b7":"M449 895H782V530H449Z","\u00ab":"M1042 1059V821L766 600L1042 379V141L573 535V666ZM588 1059V821L311 600L588 379V141L119 535V666Z","\u00bb":"M193 1059 662 666V535L193 141V379L469 600L193 821ZM647 1059 1116 666V535L647 141V379L924 600L647 821Z","\u2014":"M0 690H1233V444H0Z"}};
function T(str, x, y, size, fill, o = {}) {
  const s = String(str == null ? "" : str);
  const k = size / GLYPHS.upm;
  const adv = GLYPHS.adv * k;
  let x0 = o.anchor === "middle" ? x - (s.length * adv) / 2 : x;
  let out = `<g fill="${fill}"${o.glow ? ' filter="url(#glow)"' : ""}${o.opacity ? ` opacity="${o.opacity}"` : ""}>`;
  for (let i = 0; i < s.length; i++) {
    const d = GLYPHS.g[s[i]];
    if (!d) continue; // space or unmapped
    out += `<path transform="translate(${(x0 + i * adv).toFixed(1)} ${y}) scale(${k.toFixed(5)} ${(-k).toFixed(5)})" d="${d}"/>`;
  }
  return out + `</g>`;
}

const INK = "#0B0912", PANEL = "#161227", PANEL2 = "#100D1C", HAIRLINE = "#251F38";
const LIME = "#C6FF3D", MAGENTA = "#FF3EA5", OFFWHITE = "#F2F0F5", MUTED = "#8B87A0", AMBERISH = "#FFB627";
// "Unminted" is a real, expected tier here — loadMascot() and loadChapter() both
// fall back to it when there's no mint row — so it gets an explicit colour rather
// than dropping through to the fallback. MUTED reads clearly against PANEL; the
// old HAIRLINE fallback (#251F38 on #161227) rendered the chip and the art frame
// almost invisibly. Any unrecognised tier now lands on MUTED too, which is the
// safe direction: a card that shows a grey unknown chip is better than one whose
// frame silently disappears.
const TIER_COLOR = { "Super Legendary": "#FF9DF2", Legendary: "#FFD700", Epic: "#C77DFF", Rare: "#5EC9FF", Common: "#9A94AD", Unminted: MUTED };
const ELEM_COLOR = { Fire: "#FF5A3C", Water: "#3CA9FF", Earth: "#B98A3C", Air: "#9FE6FF" };

async function sb(path) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}` },
  });
  if (!r.ok) throw new Error(`sb ${r.status}`);
  return r.json();
}

// 🧠 IN-MEMORY CACHES (per warm lambda instance).
// PNG_CACHE: finished cards — X's image fetcher gets bytes in ~5ms instead of
// re-querying and re-rendering. ART_CACHE: fetched artwork — the Arweave
// download is the single slowest step (1-3s), and art never changes.
const PNG_CACHE = new Map(); // key -> { buf, t }
const ART_CACHE = new Map(); // url -> dataURI
const PNG_TTL = 15 * 60 * 1000, PNG_MAX = 30, ART_MAX = 8;
function cacheGetPng(key) {
  const hit = PNG_CACHE.get(key);
  if (hit && Date.now() - hit.t < PNG_TTL) return hit.buf;
  if (hit) PNG_CACHE.delete(key);
  return null;
}
function cachePutPng(key, buf) {
  if (PNG_CACHE.size >= PNG_MAX) PNG_CACHE.delete(PNG_CACHE.keys().next().value);
  PNG_CACHE.set(key, { buf, t: Date.now() });
}

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// The subset font is ASCII + a few marks — strip anything it can't draw so
// the card never shows tofu boxes.
const drawable = (s) => String(s || "").replace(/[^\x20-\x7E·«»—]/g, "").replace(/\s+/g, " ").trim();

async function fetchArt(url) {
  if (!url || !/^https?:\/\//.test(url)) return null;
  const cached = ART_CACHE.get(url);
  if (cached) return cached;
  try {
    // 8s, not 3s: permanent-storage art rides a gateway → CDN redirect chain,
    // and on a cold serverless start 3s regularly expired mid-download —
    // which shipped CARDS WITH NO ARTWORK (blank art box) instead of failing
    // loudly. The X crawler budget only matters for the landscape OG card,
    // and even there a slow card beats an empty one.
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 12 || buf.length > 8_000_000) return null;
    // 🔍 SNIFF THE BYTES — the gateway's content-type is unreliable. Art from
    // older mints is served as application/octet-stream (the upload was
    // missing its content-type tag), which is ALSO why those same cards show
    // blank thumbnails on Magic Eden and Solscan: browsers sniff magic bytes
    // and display anyway, strict clients reject the header and give up. We
    // sniff like a browser, so the card never ships an empty art box over a
    // header technicality.
    let mime = (r.headers.get("content-type") || "").split(";")[0];
    if (!/^image\//.test(mime)) {
      mime =
        buf[0] === 0x89 && buf[1] === 0x50 ? "image/png"
        : buf[0] === 0xff && buf[1] === 0xd8 ? "image/jpeg"
        : buf[0] === 0x47 && buf[1] === 0x49 ? "image/gif"
        : buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP" ? "image/webp"
        : null;
    }
    if (!mime || !/^image\/(png|jpeg|jpg|gif|webp)/.test(mime)) return null;
    const uri = `data:${mime};base64,${buf.toString("base64")}`;
    if (ART_CACHE.size >= ART_MAX) ART_CACHE.delete(ART_CACHE.keys().next().value);
    ART_CACHE.set(url, uri);
    return uri;
  } catch (e) { return null; }
}

// ---- The card itself --------------------------------------------------------
// Per-stat bar colours, matched to the studio's own meters (App.jsx, the PWR /
// HP / SPD / SPC rows) so a card shared to X reads as the same object as the
// card in the app.
//
// The previous rule coloured by VALUE — gold above 7, lime otherwise — which
// meant a maxed mascot rendered as four identical gold rows with no stat
// identity at all, and two mascots with different strengths looked identical.
const STAT_COLOR = { PWR: "#FF4D4D", HP: "#4DFF88", SPD: "#5EC9FF", SPC: "#C77DFF" };

function segRow(x, y, label, v, w) {
  const lit = STAT_COLOR[label] || LIME;
  const segW = (w - 9 * 4) / 10;
  let segs = "";
  for (let i = 0; i < 10; i++) {
    const on = i < v;
    const col = on ? lit : "#1C1728";
    segs += `<rect x="${(x + 74 + i * (segW + 4)).toFixed(1)}" y="${y}" width="${segW.toFixed(1)}" height="18" rx="2" fill="${col}"${on ? ` filter="url(#glow)"` : ""}/>`;
  }
  return T(label, x, y + 15, 20, MUTED) + segs + T(String(v), x + 74 + w + 14, y + 16, 22, OFFWHITE);
}

export function buildCardSVG(m) {
  const tierCol = TIER_COLOR[m.tier] || MUTED;
  const elemCol = ELEM_COLOR[m.element] || MUTED;
  const name = drawable(m.name).toUpperCase().slice(0, 26) || "UNNAMED";
  const nameSize = name.length > 18 ? 34 : name.length > 13 ? 42 : 50;
  const ticker = drawable(m.ticker).toUpperCase().slice(0, 10);
  const chips = m.isLegion ? [
    { txt: `${m.count} MASCOTS`, col: LIME },
    m.gods ? { txt: `${m.gods} GOD${m.gods === 1 ? "" : "S"}`, col: "#FF9DF2" } : null,
    m.legendaries ? { txt: `${m.legendaries} LEGENDARY`, col: "#FFD700" } : null,
  ].filter(Boolean) : [
    { txt: (m.tier || "UNMINTED").toUpperCase(), col: tierCol },
    m.universe ? { txt: m.universe.toUpperCase(), col: "#9FE6FF" } : (m.tier !== "Unminted" ? { txt: "GENESIS ERA", col: "#FF9DF2" } : null),
    m.element ? { txt: m.element.toUpperCase(), col: elemCol } : null,
    m.founderSeat ? { txt: `FOUNDER #${m.founderSeat}`, col: "#FFD700" } : null,
  ].filter(Boolean);
  const subtitle = m.isLegion ? "THE LEGION" : null;
  // Chips auto-scale to fit the column — a founder's badge must never clip.
  let chipX = 596, chipsSvg = "";
  {
    const AVAIL = 566;
    const natural = chips.reduce((a, c) => a + c.txt.length * 13.4 + 26, 0) + (chips.length - 1) * 12;
    const k = natural > AVAIL ? Math.max(0.6, AVAIL / natural) : 1;
    const fs = Math.max(12, Math.round(19 * k)), pad = 26 * k, gap = 12 * k, h = Math.round(34 * Math.max(k, 0.85));
    const ty = 170 + h / 2 + fs * 0.36;
    for (const c of chips) {
      const w = c.txt.length * 13.4 * k + pad;
      chipsSvg += `<rect x="${chipX.toFixed(1)}" y="170" width="${w.toFixed(1)}" height="${h}" rx="6" fill="${c.col}18" stroke="${c.col}" stroke-width="1.5"/>` +
        T(c.txt, chipX + w / 2, ty, fs, c.col, { anchor: "middle" });
      chipX += w + gap;
    }
  }
  const chTitle = m.chapterTitle ? drawable(m.chapterTitle).slice(0, 34) : null;
  const s = m.stats || {};
  const statRows = s.power
    ? segRow(596, 242, "PWR", s.power, 380) + segRow(596, 276, "HP", s.hp, 380) +
      segRow(596, 310, "SPD", s.speed, 380) + segRow(596, 344, "SPC", s.special, 380)
    : T("STATS SEALED UNTIL MINT", 596, 300, 20, MUTED);
  const battleHp = s.battleHp
    ? m.isLegion
      ? T("LEGION STRENGTH", 596, 416, 22, MUTED) + T(Number(s.battleHp).toLocaleString("en-US"), 830, 418, 30, "#4DFF88", { glow: true })
      : T("BATTLE HP", 596, 416, 22, MUTED) + T(String(s.battleHp), 746, 418, 30, "#4DFF88", { glow: true })
    : "";
  const n = m.chapters | 0;
  const banner = m.isLegion
    ? { txt: drawable(`» ${m.count} STRONG — THE PENTAVERSE KNOWS THEM «`).slice(0, 44), col: MAGENTA }
    : m.chapterTitle
    ? { txt: drawable(`» CHAPTER ${m.chapterNo || 1} OF ${n || m.chapterNo || 1} — ${(m.arcName || "THE SAGA").toUpperCase()} «`).slice(0, 44), col: MAGENTA }
    : m.tier === "Unminted"
      ? { txt: "» UNMINTED PREVIEW — THE SAGA AWAITS «", col: MUTED }
      : n > 0
        ? { txt: `» ${n} CHAPTER${n === 1 ? "" : "S"} LIVE IN THE PENTAVERSE «`, col: MAGENTA }
        : { txt: "» MINTED — CHAPTER ONE IS COMING «", col: AMBERISH };
  let art;
  if (m.isLegion && m.artGrid && m.artGrid.length) {
    // 🛡 Legion: a 2×2 grid of the wallet's mascots.
    const cells = [[48, 60], [302, 60], [48, 314], [302, 314]];
    art = `<rect x="48" y="60" width="500" height="500" rx="14" fill="${PANEL2}"/>`;
    m.artGrid.slice(0, 4).forEach((uri, i) => {
      const [cx, cy] = cells[i];
      art += `<clipPath id="lg${i}"><rect x="${cx}" y="${cy}" width="246" height="246" rx="10"/></clipPath>` +
        `<image href="${uri}" x="${cx}" y="${cy}" width="246" height="246" preserveAspectRatio="xMidYMid slice" clip-path="url(#lg${i})"/>`;
    });
  } else {
    art = m.artData
      ? `<image href="${m.artData}" x="48" y="60" width="500" height="500" preserveAspectRatio="xMidYMid slice" clip-path="url(#artclip)"/>`
      : `<rect x="48" y="60" width="500" height="500" rx="14" fill="${PANEL2}"/>` +
        T(name.slice(0, 1) || "?", 298, 372, 120, tierCol, { anchor: "middle", opacity: "0.55" });
  }

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
<defs>
  <clipPath id="artclip"><rect x="48" y="60" width="500" height="500" rx="14"/></clipPath>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="none"/><rect y="3" width="4" height="1" fill="#000" opacity="0.28"/></pattern>
</defs>
<rect width="1200" height="630" fill="${INK}"/>
<rect x="24" y="36" width="1152" height="558" rx="18" fill="${PANEL}" stroke="${HAIRLINE}" stroke-width="2"/>
${art}
<rect x="48" y="60" width="500" height="500" rx="14" fill="none" stroke="${tierCol}" stroke-width="3" filter="url(#glow)"/>
${T(name, 596, 110, nameSize, OFFWHITE, { glow: true })}
${chTitle ? T(`CH.${m.chapterNo || 1} — ${chTitle.toUpperCase()}`, 596, 148, 24, AMBERISH) : subtitle ? T(subtitle, 596, 148, 26, LIME) : ticker ? T(`$${ticker}`, 596, 148, 26, LIME) : ""}
${chipsSvg}
${statRows}
${battleHp}
<rect x="576" y="446" width="576" height="66" rx="10" fill="${banner.col}14" stroke="${banner.col}" stroke-width="2" filter="url(#glow)"/>
${T(banner.txt, 864, 489, banner.txt.length > 34 ? 22 : 26, banner.col, { anchor: "middle" })}
${T("MASCOTGEN", 596, 566, 22, LIME)}
${T("· mascotgen.studio", 732, 566, 20, MUTED)}
<rect x="24" y="36" width="1152" height="558" rx="18" fill="url(#scan)" opacity="0.14" pointer-events="none"/>
</svg>`;
}

// ---- ⬇ THE TRADING CARD (portrait) -----------------------------------------
// /api/share?id&img=1&card=1 → a 750×1050 PNG of the FULL trading card, the
// thing people screenshot to post on X and Telegram — now downloadable clean.
// Reuses everything the landscape card already built: fetched base64 art,
// glyph text, tier/element colours, live computeStats. Kept deliberately
// simple: frame, name, art, four stats, battle HP, element, tagline, site.
export function buildTradingCardSVG(m) {
  const tierCol = TIER_COLOR[m.tier] || MUTED;
  const elemCol = ELEM_COLOR[m.element] || MUTED;
  const name = drawable(m.name).toUpperCase().slice(0, 24) || "UNNAMED";
  const nameSize = name.length > 18 ? 36 : name.length > 13 ? 44 : 52;
  const ticker = drawable(m.ticker).toUpperCase().slice(0, 10);
  const tag = drawable(m.tagline).slice(0, 74);
  const s = m.stats || {};
  const sv = (v) => (v == null ? "?" : String(v));
  const stat = (label, val, x) =>
    `<rect x="${x}" y="852" width="156" height="92" rx="12" fill="${PANEL2}" stroke="${HAIRLINE}"/>` +
    T(label, x + 78, 888, 17, MUTED, { anchor: "middle" }) +
    T(sv(val), x + 78, 932, 30, OFFWHITE, { anchor: "middle" });
  // xlink:href AND href, both: some resvg builds only honor the legacy
  // xlink form for <image>, and shipping both costs nothing.
  const art = m.artData
    ? `<image xlink:href="${m.artData}" href="${m.artData}" x="43" y="158" width="664" height="664" preserveAspectRatio="xMidYMid slice" clip-path="url(#tcart)"/>`
    : `<rect x="43" y="158" width="664" height="664" rx="16" fill="${PANEL2}"/>` +
      T(name.slice(0, 1) || "?", 375, 540, 150, tierCol, { anchor: "middle", opacity: "0.5" });
  return `<svg width="750" height="1050" viewBox="0 0 750 1050" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
<defs>
  <clipPath id="tcart"><rect x="43" y="158" width="664" height="664" rx="16"/></clipPath>
  <filter id="glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="750" height="1050" fill="${INK}"/>
<rect x="14" y="14" width="722" height="1022" rx="24" fill="${PANEL}" stroke="${tierCol}" stroke-width="3"/>
<rect x="22" y="22" width="706" height="1006" rx="19" fill="none" stroke="${HAIRLINE}"/>
${T(name, 375, 76, nameSize, OFFWHITE, { anchor: "middle", glow: true })}
${T(`${ticker ? "$" + ticker + " · " : ""}${(m.tier || "UNMINTED").toUpperCase()}${m.founderSeat ? ` · FOUNDER #${m.founderSeat}` : ""}`, 375, 112, 19, tierCol, { anchor: "middle" })}
${T(m.universe ? m.universe.toUpperCase() : "GENESIS ERA", 375, 140, 17, m.universe ? "#9FE6FF" : "#FF9DF2", { anchor: "middle" })}
${art}
${stat("PWR", s.power, 43)}
${stat("HP", s.hp, 213)}
${stat("SPD", s.speed, 383)}
${stat("SPC", s.special, 553)}
${T(`BATTLE HP ${sv(s.battleHp)}`, 43, 985, 22, LIME)}
${m.element ? `<rect x="${707 - (m.element.length * 13.3 + 40)}" y="960" width="${m.element.length * 13.3 + 40}" height="34" rx="17" fill="${PANEL2}" stroke="${elemCol}"/>` + T(m.element.toUpperCase(), 707 - (m.element.length * 13.3 + 40) / 2, 984, 18, elemCol, { anchor: "middle" }) : ""}
${tag ? T(`"${tag}"`, 375, 1016, 15, MUTED, { anchor: "middle" }) : T("mascotgen.studio", 375, 1016, 15, MUTED, { anchor: "middle" })}
</svg>`;
}

// ---- Load everything the card needs ----------------------------------------
async function loadMascot(id) {
  // ⏱ X's crawler waits ~5 seconds for og:image and caches a miss. Every read
  // here runs CONCURRENTLY so a cold start still answers inside that budget.
  const isMintId = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id);
  const [shareRows, directMint] = await Promise.all([
    sb(`shared_mascots?id=eq.${encodeURIComponent(id)}&select=data`).catch(() => []),
    isMintId
      ? sb(`mints?mint_address=eq.${encodeURIComponent(id)}&select=character_name,ticker,traits,card_tier,rarity,element,universe,image_url,marked_by,age_card,age_number,legendary_season,mint_number,result_data`).catch(() => [])
      : Promise.resolve([]),
  ]);
  let data = null;
  if (shareRows[0] && shareRows[0].data && !shareRows[0].data.__resume) data = shareRows[0].data;
  const mintAddress = (data && data.mintAddress) || (isMintId ? id : null);
  let mintRow = (directMint && directMint[0]) || null, chapters = 0;
  if (mintAddress) {
    const [mintRows, chRows] = await Promise.all([
      mintRow || mintAddress === id
        ? Promise.resolve(mintRow ? [mintRow] : [])
        : sb(`mints?mint_address=eq.${encodeURIComponent(mintAddress)}&select=character_name,ticker,traits,card_tier,rarity,element,universe,image_url,marked_by,age_card,age_number,legendary_season,mint_number,result_data`).catch(() => []),
      sb(`published_chapters?mint_address=eq.${encodeURIComponent(mintAddress)}&select=id`).catch(() => []),
    ]);
    if (!mintRow && mintRows[0]) mintRow = mintRows[0];
    chapters = (chRows || []).length;
  }
  if (!data && !mintRow) return null;

  // The mint row is the truth wherever both exist — a share snapshot frozen
  // before minting must never outrank the on-chain card.
  const tier = mintRow ? (mintRow.card_tier || mintRow.rarity || "Common") : (data && data.tier) || "Unminted";
  let stats = (data && data.stats) || null;
  let element = (data && data.element) || null;
  if (mintRow && mintRow.traits) {
    try {
      const live = computeStats(
        { ...mintRow.traits, characterName: mintRow.character_name, element: mintRow.element || undefined },
        tier, mintRow.marked_by || null, mintRow.age_card || null, mintRow.age_number || null,
        !mintRow.universe,
        tier === "Legendary" && mintRow.mint_number >= 1 && mintRow.mint_number <= 333 ? mintRow.mint_number : null // ⚜️ Founder seat = MINT NUMBER, not season cohort
      );
      stats = { power: live.power, hp: live.hp, speed: live.speed, special: live.special, battleHp: live.hpPoints };
      element = live.element ? live.element.id : (mintRow.element || element);
    } catch (e) {}
  }
  const rd = (mintRow && mintRow.result_data) || {};
  return {
    id,
    name: (mintRow && mintRow.character_name) || (data && data.name) || "Unnamed",
    ticker: (mintRow && mintRow.ticker) || (data && data.ticker) || "",
    tagline: (data && data.tagline) || rd.tagline || "",
    bio: (data && data.bio) || rd.bio || "",
    tier,
    universe: (mintRow && mintRow.universe) || (data && data.universe) || null,
    element,
    stats,
    image: (mintRow && mintRow.image_url) || (data && data.image) || null,
    chapters,
    founderSeat: mintRow && tier === "Legendary" && mintRow.mint_number >= 1 && mintRow.mint_number <= 333 ? mintRow.mint_number : null,
  };
}

// A published chapter's card — the character's face, the chapter's name, and
// where it sits in the saga. Also carries the PANELS, because /s/c/<id> now
// renders the chapter as readable text instead of bouncing humans into the app.
async function loadChapter(id) {
  let ch = null;
  try {
    const rows = await sb(`published_chapters?id=eq.${encodeURIComponent(id)}&select=id,mint_address,character_name,arc_name,chapter_no,title,panels`);
    ch = rows && rows[0];
  } catch (e) {}
  if (!ch) return null;
  let mintRow = null, total = 0;
  if (ch.mint_address) {
    const [mintRows, chRows] = await Promise.all([
      sb(`mints?mint_address=eq.${encodeURIComponent(ch.mint_address)}&select=character_name,ticker,traits,card_tier,rarity,element,universe,image_url,marked_by,age_card,age_number,legendary_season,mint_number`).catch(() => []),
      sb(`published_chapters?mint_address=eq.${encodeURIComponent(ch.mint_address)}&select=id`).catch(() => []),
    ]);
    mintRow = mintRows && mintRows[0];
    total = (chRows || []).length;
  }
  // No mint row means the chapter's mascot isn't minted (or the row couldn't be
  // read). This used to fall back to "Legendary", which stamped a gold
  // LEGENDARY chip on cards that had never been minted at all — the card
  // claimed the rarest tier in the game on no evidence. "Unminted" is already
  // handled everywhere downstream (it draws the sealed-stats state instead).
  const tier = mintRow ? (mintRow.card_tier || mintRow.rarity || "Common") : "Unminted";
  let stats = null, element = null;
  if (mintRow && mintRow.traits) {
    try {
      const live = computeStats(
        { ...mintRow.traits, characterName: ch.character_name, element: mintRow.element || undefined },
        tier, mintRow.marked_by || null, mintRow.age_card || null, mintRow.age_number || null,
        !mintRow.universe,
        tier === "Legendary" && mintRow.mint_number >= 1 && mintRow.mint_number <= 333 ? mintRow.mint_number : null
      );
      stats = { power: live.power, hp: live.hp, speed: live.speed, special: live.special, battleHp: live.hpPoints };
      element = live.element ? live.element.id : (mintRow.element || null);
    } catch (e) {}
  }
  return {
    id: ch.id,
    name: ch.character_name || (mintRow && mintRow.character_name) || "Unnamed",
    ticker: (mintRow && mintRow.ticker) || "",
    tagline: "",
    bio: "",
    tier,
    universe: (mintRow && mintRow.universe) || null,
    element,
    stats,
    image: (mintRow && mintRow.image_url) || null,
    chapters: total || ch.chapter_no || 1,
    founderSeat: mintRow && tier === "Legendary" && mintRow.mint_number >= 1 && mintRow.mint_number <= 333 ? mintRow.mint_number : null,
    // 📖 The actual prose. Already selected above and previously thrown away —
    // the chapter page existed only for crawlers, and humans were redirected
    // into the app before they could read a word of it.
    panels: Array.isArray(ch.panels) ? ch.panels.map((p) => String(p || "")).filter(Boolean) : [],
    chapterTitle: ch.title || `Chapter ${ch.chapter_no || 1}`,
    chapterNo: ch.chapter_no || 1,
    arcName: ch.arc_name || null,
    firstPanel: Array.isArray(ch.panels) && ch.panels[0] ? String(ch.panels[0]) : "",
  };
}

// 🛡 A WHOLE LEGION on one card — every mascot a wallet holds, aggregated.
async function loadLegion(walletAddr) {
  const [rows, profs] = await Promise.all([
    sb(`mints?owner_wallet=eq.${encodeURIComponent(walletAddr)}&select=character_name,traits,card_tier,rarity,element,universe,marked_by,age_card,age_number,mint_number,image_url,god_number&limit=500`).catch(() => []),
    sb(`profiles?wallet=eq.${encodeURIComponent(walletAddr)}&select=username`).catch(() => []),
  ]);
  if (!rows || !rows.length) return null;
  const username = profs && profs[0] && profs[0].username ? profs[0].username : null;
  let strength = 0, pw = 0, hp = 0, sp = 0, sx = 0, statted = 0;
  const tierCount = {};
  for (const r of rows) {
    const tier = r.card_tier || r.rarity || "Common";
    tierCount[tier] = (tierCount[tier] || 0) + 1;
    try {
      const live = computeStats(
        { ...(r.traits || {}), characterName: r.character_name, element: r.element || undefined },
        tier, r.marked_by || null, r.age_card || null, r.age_number || null,
        !r.universe,
        tier === "Legendary" && r.mint_number >= 1 && r.mint_number <= 333 ? r.mint_number : null
      );
      strength += live.hpPoints || 0;
      pw += live.power; hp += live.hp; sp += live.speed; sx += live.special;
      statted++;
    } catch (e) {}
  }
  const avg = (v) => (statted ? Math.max(1, Math.min(10, Math.round(v / statted))) : 0);
  const gods = tierCount["Super Legendary"] || 0;
  return {
    id: walletAddr,
    isLegion: true,
    name: username ? `@${username}` : `${walletAddr.slice(0, 4)}..${walletAddr.slice(-4)}`,
    username,
    count: rows.length,
    gods,
    legendaries: tierCount["Legendary"] || 0,
    tier: gods > 0 ? "Super Legendary" : "Legendary",
    universe: null,
    element: null,
    stats: statted ? { power: avg(pw), hp: avg(hp), speed: avg(sp), special: avg(sx), battleHp: strength } : null,
    strength,
    images: rows.map((r) => r.image_url).filter(Boolean).slice(0, 4),
    chapters: 0,
  };
}

export default async function handler(req, res) {
  const chapterId = String((req.query && req.query.chapter) || "").slice(0, 80);
  const legionId = String((req.query && req.query.legion) || "").slice(0, 80);
  const id = chapterId || legionId || String((req.query && req.query.id) || "").slice(0, 80);
  if (!id) return res.status(400).send("Missing id");

  let m = null;
  try { m = chapterId ? await loadChapter(chapterId) : legionId ? await loadLegion(legionId) : await loadMascot(id); } catch (e) {}

  const host = (req.headers && req.headers.host) || "mascotgen.studio";
  const base = `https://${host}`;

  // 🖼 &art=1 — same-origin art proxy. Returns the mascot's raw image bytes
  // with a correct sniffed content-type. Exists so the CLIENT can draw the
  // trading card on a canvas without cross-origin taint: the browser fetches
  // /api/share?art=1 (same origin, always allowed) instead of the Irys
  // gateway (whose CORS and content-type headers are unreliable).
  if (req.query && req.query.art) {
    if (!m || m.isLegion) return res.status(404).send("Not found");
    const uri = await fetchArt(m.image);
    if (!uri) return res.status(404).send("no art");
    const mime = uri.slice(5, uri.indexOf(";"));
    const buf = Buffer.from(uri.slice(uri.indexOf(",") + 1), "base64");
    res.setHeader("Content-Type", mime);
    res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
    return res.status(200).send(buf);
  }

  // 🔬 &imgdebug=1 — answers "why is the art box empty" in one request:
  // shows which image URL the server has for this mascot and whether it could
  // actually be fetched and decoded. Reads only, returns JSON, no secrets.
  if (req.query && req.query.imgdebug) {
    if (!m) return res.status(404).json({ error: "not found" });
    const art = m.isLegion ? null : await fetchArt(m.image);
    res.setHeader("Cache-Control", "no-store");
    // mime matters: resvg cannot draw WebP — if this says image/webp, that IS
    // the blank-art bug and the image needs converting, not more SVG fixes.
    const mime = art ? art.slice(5, art.indexOf(";")) : null;
    return res.status(200).json({ image: m.image || null, artFetched: !!art, mime, bytes: art ? art.length : 0 });
  }

  if (req.query && req.query.img) {
    // &card=1 → the portrait trading card instead of the landscape share card.
    // The flag MUST be part of the cache key or the two formats collide.
    const wantCard = !!req.query.card;
    const cacheKey = `${chapterId || id}:${(req.query && req.query.ch) || ""}${wantCard ? ":card" : ""}`;
    const hot = cacheGetPng(cacheKey);
    if (hot) {
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      res.setHeader("X-Card-Cache", "ram");
      return res.status(200).send(hot);
    }
    if (!m) return res.status(404).send("Not found");
    if (m.isLegion) {
      m.artGrid = (await Promise.all((m.images || []).map((u) => fetchArt(u)))).filter(Boolean).slice(0, 4);
    } else {
      m.artData = await fetchArt(m.image);
    }
    try {
      const svg = wantCard && !m.isLegion ? buildTradingCardSVG(m) : buildCardSVG(m);
      const png = new Resvg(svg, {
        // Portrait card renders at 2× (1500 wide) — it gets zoomed on phones
        // and posted on X, where a 750px render looks soft next to the app.
        fitTo: { mode: "width", value: wantCard && !m.isLegion ? 1500 : 1200 },
        font: { loadSystemFonts: false }, // no fonts needed — text is pre-baked geometry
      }).render().asPng();
      const out = Buffer.from(png);
      cachePutPng(cacheKey, out);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, s-maxage=86400, stale-while-revalidate=604800");
      return res.status(200).send(out);
    } catch (e) {
      // Card render failed — fall back to the raw art so the tweet still shows
      // SOMETHING rather than a broken image.
      if (m.image) { res.setHeader("Cache-Control", "public, s-maxage=120"); return res.redirect(302, m.image); }
      return res.status(500).send("Card render failed");
    }
  }

  // ---- HTML mode: the tags the crawler came for ----------------------------
  if (!m) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(404).send(`<!doctype html><html><head><meta charset="utf-8"><title>MascotGen</title></head><body style="background:${INK};color:${OFFWHITE};font-family:monospace;padding:40px"><p>This mascot page doesn't exist (or was never shared).</p><a style="color:${LIME}" href="/">mascotgen.studio</a></body></html>`);
  }
  const n = m.chapters | 0;
  if (m.isLegion) {
    const ltitle = `${m.name}'s Legion · ${m.count} mascot${m.count === 1 ? "" : "s"} · Strength ${m.strength.toLocaleString("en-US")}`;
    const ldesc = `${m.count} mascots strong${m.gods ? ` — including ${m.gods} god${m.gods === 1 ? "" : "s"} of the Pentaverse` : ""}. Combined battle strength ${m.strength.toLocaleString("en-US")}. Build yours at mascotgen.studio.`;
    const limg = `${base}/api/share?legion=${encodeURIComponent(id)}&img=1&n=${m.count}`;
    const lpage = `${base}/s/u/${encodeURIComponent(id)}`;
    const lapp = m.username ? `/?a=${encodeURIComponent(m.username)}` : "/";
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(ltitle)} · MascotGen</title>
<meta name="description" content="${esc(ldesc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="MascotGen">
<meta property="og:title" content="${esc(ltitle)}"><meta property="og:description" content="${esc(ldesc)}">
<meta property="og:url" content="${esc(lpage)}">
<meta property="og:image" content="${esc(limg)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">${process.env.X_HANDLE ? `<meta name="twitter:site" content="${esc(process.env.X_HANDLE)}">` : ""}
<meta name="twitter:title" content="${esc(ltitle)}"><meta name="twitter:description" content="${esc(ldesc)}">
<meta name="twitter:image" content="${esc(limg)}">
</head><body style="background:${INK};color:${OFFWHITE};font-family:monospace;padding:40px">
<p>Opening <b>${esc(m.name)}</b>'s Legion&hellip;</p><a style="color:${LIME}" href="${esc(lapp)}">Tap here if nothing happens</a>
<script>location.replace(${JSON.stringify(lapp)});</script></body></html>`);
  }
  const title = m.chapterTitle
    ? `${m.chapterTitle} — ${m.name} (Chapter ${m.chapterNo})`
    : `${m.name}${m.ticker ? ` — $${m.ticker}` : ""}${n ? ` · ${n} chapter${n === 1 ? "" : "s"}` : ""}`;
  const descBits = [];
  if (m.chapterTitle && m.firstPanel) descBits.push(m.firstPanel.slice(0, 160) + "…");
  if (m.tagline) descBits.push(m.tagline);
  descBits.push(m.chapterTitle
    ? `Chapter ${m.chapterNo} of ${n}${m.arcName ? ` in ${m.arcName}` : ""} — read it on MascotGen.`
    : n > 0 ? `${n} chapter${n === 1 ? "" : "s"} live in the Pentaverse.` : "A legend of the Pentaverse.");
  if (m.tier && m.tier !== "Unminted") descBits.push(`${m.tier}${m.universe ? ` · ${m.universe}` : " · Genesis Era"}${m.element ? ` · ${m.element}` : ""}.`);
  if (m.founderSeat) descBits.push(`One of the Founding 333 — seat #${m.founderSeat}.`);
  const desc = descBits.join(" ").slice(0, 280);
  // Chapter image URLs carry no &ch: a chapter's own card barely changes, and
  // a stable URL means the app can pre-warm the EXACT bytes X will request.
  // Mascot cards keep &ch=N — that URL changing as the saga grows is the
  // cache-bust that keeps X current.
  const imgUrl = chapterId
    ? `${base}/api/share?chapter=${encodeURIComponent(chapterId)}&img=1`
    : `${base}/api/share?id=${encodeURIComponent(id)}&img=1&ch=${n}`;
  const pageUrl = chapterId ? `${base}/s/c/${encodeURIComponent(chapterId)}` : `${base}/s/${encodeURIComponent(id)}`;
  const appUrl = chapterId ? `/?c=${encodeURIComponent(chapterId)}` : `/?m=${encodeURIComponent(id)}`;
  const xHandle = process.env.X_HANDLE ? `<meta name="twitter:site" content="${esc(process.env.X_HANDLE)}">` : "";

  // ---- 📖 THE READER -------------------------------------------------------
  // This page used to exist ONLY for crawlers: it served the unfurl tags and
  // then `location.replace()`d every human into the app. Anyone arriving from
  // outside — a link in a forum, a serial-fiction reader, someone who just
  // wanted to read the story — hit a wallet-connect screen before seeing a
  // single word. That made the whole catalogue unpostable anywhere that isn't
  // already a crypto audience.
  //
  // Now the chapter RENDERS. Title, art, prose, and one quiet line at the
  // bottom about where the world comes from. No wallet, no token, no mint
  // button, no redirect. The crawler tags above are untouched, so X and
  // Telegram unfurls behave exactly as before.
  //
  // 🛡 PANEL TEXT IS USER-AUTHORED and goes through esc() individually. Never
  // interpolate a panel raw — a published chapter is written by whoever owns
  // the mascot, and this page is public.
  const isChapter = !!chapterId && (m.panels || []).length > 0;
  const readerStyles = `<style>
  :root{--ink:${INK};--panel:${PANEL};--hair:${HAIRLINE};--off:${OFFWHITE};--muted:${MUTED};--lime:${LIME};--magenta:${MAGENTA}}
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--ink);color:var(--off);font-family:Georgia,'Iowan Old Style',serif;line-height:1.75;padding:32px 20px 80px}
  .wrap{max-width:680px;margin:0 auto}
  .kicker{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin-bottom:10px}
  h1{font-size:clamp(26px,5vw,38px);line-height:1.2;margin-bottom:6px;color:var(--off)}
  .by{font-family:ui-monospace,monospace;font-size:12px;color:var(--muted);margin-bottom:26px}
  .by b{color:var(--lime);font-weight:400}
  .art{width:100%;border-radius:14px;border:1px solid var(--hair);margin-bottom:30px;display:block}
  p.panel{font-size:18px;margin-bottom:22px;white-space:pre-wrap}
  .rule{height:1px;background:var(--hair);margin:38px 0 22px}
  .foot{font-family:ui-monospace,monospace;font-size:12.5px;color:var(--muted);line-height:1.85}
  .foot a{color:var(--lime);text-decoration:none;border-bottom:1px solid rgba(198,255,61,.35)}
  .foot a:hover{border-bottom-color:var(--lime)}
  .more{margin-top:14px}
  </style>`;
  const readerBody = isChapter
    ? `<div class="wrap">
  <div class="kicker">${esc(m.arcName ? `${m.arcName} · Part ${m.chapterNo}` : `Chapter ${m.chapterNo}`)}</div>
  <h1>${esc(m.chapterTitle)}</h1>
  <div class="by">a chapter in the saga of <b>${esc(m.name)}</b></div>
  ${m.image ? `<img class="art" src="${esc(m.image)}" alt="${esc(m.name)}">` : ""}
  ${m.panels.map((p) => `<p class="panel">${esc(p)}</p>`).join("\n  ")}
  <div class="rule"></div>
  <div class="foot">
    <div>${esc(m.name)} is a character in <b>the Pentaverse</b> — five universes, twelve thrones, and a war that drowned the five.</div>
    <div class="more"><a href="${esc(appUrl)}">Read the rest of ${esc(m.name)}'s saga →</a></div>
  </div>
</div>`
    : `<div class="wrap">
  <h1>${esc(m.name)}</h1>
  <div class="by">${esc(desc)}</div>
  ${m.image ? `<img class="art" src="${esc(m.image)}" alt="${esc(m.name)}">` : ""}
  <div class="foot"><a href="${esc(appUrl)}">Open ${esc(m.name)}'s page →</a></div>
</div>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
  return res.status(200).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · MascotGen</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="MascotGen">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta property="og:image" content="${esc(imgUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${xHandle}
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(imgUrl)}">
${readerStyles}</head>
<body>${readerBody}</body></html>`);
}
