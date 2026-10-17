-- Transformation System Library
-- Handles the saga transformation data and aura effects
-- saga = {[vocation_id] = {lookType = 1683, aura = 350, level = 50, effect = 240}}
vocationNames = {
    [1] = "Bardock",
    [2] = "Bills",
    [3] = "Botamo",
    [4] = "Brolly",
    [5] = "Bulma",
    [6] = "Buu",
    [7] = "C8",
    [8] = "C17",
    [9] = "C18",
    [10] = "Cabba",
    [11] = "Cell",
    [12] = "Cooler",
    [13] = "Dende",
    [14] = "Freeza",
    [15] = "Ginn",
    [16] = "Gohan",
    [17] = "Goku",
    [18] = "Goku Black",
    [19] = "Hitto",
    [20] = "Janemba",
    [21] = "Jiren",
    [22] = "Kagome",
    [23] = "Kaio",
    [24] = "Kame",
    [25] = "King Cold",
    [26] = "King Vegeta",
    [27] = "Kuririn",
    [28] = "Liquir",
    [29] = "Pan",
    [30] = "Piccolo",
    [31] = "Quitela",
    [32] = "Raditz",
    [33] = "Shenron",
    [34] = "Tapion",
    [35] = "Trunks",
    [36] = "Tsuful",
    [37] = "Turles",
    [38] = "Uub",
    [39] = "Vados",
    [40] = "Vegeta",
    [41] = "Vegetto",
    [42] = "Vermouth",
    [43] = "Videl",
    [44] = "Zaiko",
    [45] = "Zeno",
    [47] = "Aizen",
    [48] = "Byakuya",
    [49] = "Gin",
    [50] = "Grimmjow",
    [51] = "Hitsugaya",
    [52] = "Ichigo FullBring",
    [53] = "Ichigo",
    [54] = "Ishida",
    [55] = "Kyouraku",
    [56] = "Neliel",
    [57] = "Orihime",
    [58] = "Renji",
    [59] = "Rukia",
    [60] = "Sado",
    [61] = "Shinji",
    [62] = "Soi Fong",
    [63] = "Tousen",
    [64] = "Ulquiorra",
    [65] = "Urahara",
    [66] = "Yoruichi",
    [67] = "Zaraki"
}

extraOutfits = {
    -- { name = "Event Outfit", lookType = 123, level = 1, vocation = {1, 17}, storage = 45678 },
}

saga = {
    -- Bardock
    [1] = {
        { lookType = 1683 },
        { lookType = 1684, aura = 350 },
        { lookType = 1685 },
        { lookType = 1686 },
        { lookType = 1687 },
        { lookType = 1688 },
        { lookType = 1689 },
        { lookType = 1690 },
        { lookType = 1691 },
        { lookType = 1692 },
        { lookType = 1693 },
        { lookType = 1694 },
        level = 50,
        effect = 240
    },
    -- Bills
    [2] = {
        { lookType = 1711 },
        { lookType = 1709, aura = 351 },
        { lookType = 1716 },
        { lookType = 1712 },
        { lookType = 1717 },
        { lookType = 1714 },
        { lookType = 1719 },
        { lookType = 1713 },
        { lookType = 1715 },
        { lookType = 1718 },
        { lookType = 1710 },
        { lookType = 1720 },
        { lookType = 1721 },
        { lookType = 1722 },
        level = 50,
        effect = 240
    },
    -- Botamo
    [3] = {
        { lookType = 1731 },
        { lookType = 1730, aura = 352 },
        { lookType = 1729 },
        { lookType = 1728 },
        { lookType = 1726 },
        { lookType = 1727 },
        { lookType = 1725 },
        { lookType = 1724 },
        { lookType = 1723 },
        level = 50,
        effect = 240
    },
    -- Brolly
    [4] = {
        { lookType = 1739 },
        { lookType = 1738, aura = 353 },
        { lookType = 1742 },
        { lookType = 1743 },
        { lookType = 1741 },
        { lookType = 1740 },
        { lookType = 1744 },
        { lookType = 1737 },
        { lookType = 1736 },
        { lookType = 1735 },
        { lookType = 1734 },
        { lookType = 1733 },
        { lookType = 1732 },
        level = 50,
        effect = 240
    },
    -- Bulma
    [5] = {
        { lookType = 1748 },
        { lookType = 1747, aura = 354 },
        { lookType = 1746 },
        { lookType = 1745 },
        { lookType = 1749 },
        { lookType = 1750 },
        { lookType = 1751 },
        { lookType = 1752 },
        { lookType = 1753 },
        { lookType = 1754 },
        level = 50,
        effect = 240
    },
    -- Buu
    [6] = {
        { lookType = 1755 },
        { lookType = 1756, aura = 355 },
        { lookType = 1757 },
        { lookType = 1758 },
        { lookType = 1759 },
        { lookType = 1760 },
        { lookType = 1761 },
        { lookType = 1762 },
        { lookType = 1763 },
        { lookType = 1764 },
        level = 50,
        effect = 240
    },
    -- C8
    [7] = {
        { lookType = 1777 },
        { lookType = 1767, aura = 356 },
        { lookType = 1766 },
        { lookType = 1767 },
        { lookType = 1768 },
        { lookType = 1769 },
        { lookType = 1770 },
        { lookType = 1771 },
        { lookType = 1772 },
        { lookType = 1773 },
        { lookType = 1774 },
        { lookType = 1775 },
        { lookType = 1776 },
        level = 50,
        effect = 240
    },
    -- C17
    [8] = {
        { lookType = 1777 },
        { lookType = 1778, aura = 357 },
        { lookType = 1779 },
        { lookType = 1780 },
        { lookType = 1781 },
        { lookType = 1782 },
        { lookType = 1783 },
        { lookType = 1784 },
        { lookType = 1785 },
        level = 50,
        effect = 240
    },
    -- C18
    [9] = {
        { lookType = 1777 },
        { lookType = 1786, aura = 358 },
        { lookType = 1787 },
        { lookType = 1788 },
        { lookType = 1789 },
        { lookType = 1790 },
        { lookType = 1791 },
        { lookType = 1792 },
        { lookType = 1793 },
        level = 50,
        effect = 240
    },
    -- Cabba
    [10] = {
        { lookType = 1794 },
        { lookType = 1795, aura = 359 },
        { lookType = 1796 },
        { lookType = 1797 },
        { lookType = 1798 },
        { lookType = 1799 },
        { lookType = 1800 },
        { lookType = 1801 },
        { lookType = 1802 },
        { lookType = 1803 },
        level = 50,
        effect = 240
    },
    -- Cell
    [11] = {
        { lookType = 1804 },
        { lookType = 1805, aura = 360 },
        { lookType = 1806 },
        { lookType = 1807 },
        { lookType = 1808 },
        { lookType = 1809 },
        { lookType = 1810 },
        level = 50,
        effect = 240
    },
    -- Cooler
    [12] = {
        { lookType = 1811 },
        { lookType = 1812, aura = 361 },
        { lookType = 1813 },
        { lookType = 1814 },
        { lookType = 1815 },
        { lookType = 1818 },
        { lookType = 1820 },
        { lookType = 1816 },
        { lookType = 1817 },
        { lookType = 1819 },
        { lookType = 1821 },
        level = 50,
        effect = 240
    },
    -- Dende
    [13] = {
        { lookType = 1822 },
        { lookType = 1823, aura = 362 },
        { lookType = 1824 },
        { lookType = 1825 },
        { lookType = 1826 },
        { lookType = 1827 },
        { lookType = 1828 },
        { lookType = 1829 },
        { lookType = 1830 },
        { lookType = 1831 },
        { lookType = 1832 },
        { lookType = 1833 },
        { lookType = 1834 },
        level = 50,
        effect = 240
    },
    -- Freeza
    [14] = {
        { lookType = 1835 },
        { lookType = 1836, aura = 363 },
        { lookType = 1837 },
        { lookType = 1838 },
        { lookType = 1839 },
        { lookType = 1840 },
        { lookType = 1841 },
        { lookType = 1842 },
        { lookType = 1843 },
        { lookType = 1844 },
        level = 50,
        effect = 240
    },
    -- Ginn
    [15] = {
        { lookType = 1845 },
        { lookType = 1846, aura = 364 },
        { lookType = 1847 },
        { lookType = 1848 },
        { lookType = 1849 },
        { lookType = 1850 },
        { lookType = 1851 },
        { lookType = 1852 },
        { lookType = 1853 },
        level = 50,
        effect = 240
    },
    -- Gohan
    [16] = {
        { lookType = 1854 },
        { lookType = 1855, aura = 365 },
        { lookType = 1856 },
        { lookType = 1857 },
        { lookType = 1858 },
        { lookType = 1859 },
        { lookType = 1860 },
        { lookType = 1861 },
        { lookType = 1862 },
        { lookType = 1863 },
        { lookType = 1864 },
        { lookType = 1865 },
        { lookType = 1866 },
        { lookType = 1867 },
        { lookType = 1868 },
        level = 50,
        effect = 240
    },
    -- Goku
    [17] = {
        { lookType = 1881 },
        { lookType = 1882, aura = 2694 },
        { lookType = 1883, aura = 344 },
        { lookType = 1884, aura = 344 },
        { lookType = 1885, aura = 330 },
        { lookType = 1886, aura = 1944, auraPos = { x = 0, y = 0, z = 0 } },
        { lookType = 1887 },
        { lookType = 1888 },
        { lookType = 1889 },
        { lookType = 1890 },
        { lookType = 1891 },
        { lookType = 1892 },
        { lookType = 1893 },
        { lookType = 1894 },
        { lookType = 1895 },
        { lookType = 1896 },
        { lookType = 1897 },
        { lookType = 1898 },
        { lookType = 1899 },
        level = 50,
        effect = 240,
        effectPos = { x = 0, y = 0, z = 0 }
    },
    -- Goku Black
    [18] = {
        { lookType = 1869 },
        { lookType = 1870, aura = 367 },
        { lookType = 1871 },
        { lookType = 1872 },
        { lookType = 1873 },
        { lookType = 1874 },
        { lookType = 1875 },
        { lookType = 1876 },
        { lookType = 1877 },
        { lookType = 1878 },
        { lookType = 1879 },
        { lookType = 1880 },
        level = 50,
        effect = 240
    },
    -- Hitto
    [19] = {
        { lookType = 1900 },
        { lookType = 1901, aura = 368 },
        { lookType = 1902 },
        { lookType = 1903 },
        { lookType = 1904 },
        { lookType = 1905 },
        { lookType = 1906 },
        { lookType = 1907 },
        { lookType = 1908 },
        level = 50,
        effect = 240
    },
    -- Janemba
    [20] = {
        { lookType = 1909 },
        { lookType = 1910, aura = 369 },
        { lookType = 1911 },
        { lookType = 1912 },
        { lookType = 1913 },
        { lookType = 1914 },
        { lookType = 1915 },
        { lookType = 1916 },
        level = 50,
        effect = 240
    },
    -- Jiren
    [21] = {
        { lookType = 1917 },
        { lookType = 1918, aura = 370 },
        { lookType = 1919 },
        { lookType = 1920 },
        { lookType = 1921 },
        { lookType = 1922 },
        { lookType = 1923 },
        { lookType = 1924 },
        { lookType = 1925 },
        { lookType = 1926 },
        { lookType = 1927 },
        { lookType = 1928 },
        { lookType = 1929 },
        { lookType = 1930 },
        level = 50,
        effect = 240
    },
    -- Kagome
    [22] = {
        { lookType = 1931 },
        { lookType = 1932, aura = 371 },
        { lookType = 1933 },
        { lookType = 1934 },
        { lookType = 1935 },
        { lookType = 1936 },
        { lookType = 1937 },
        { lookType = 1938 },
        { lookType = 1939 },
        { lookType = 1940 },
        { lookType = 1941 },
        level = 50,
        effect = 240
    },
    -- Kaio
    [23] = {
        { lookType = 1942 },
        { lookType = 1943, aura = 372 },
        { lookType = 1944 },
        { lookType = 1945 },
        { lookType = 1946 },
        { lookType = 1947 },
        { lookType = 1948 },
        { lookType = 1949 },
        { lookType = 1950 },
        level = 50,
        effect = 240
    },
    -- Kame
    [24] = {
        { lookType = 1951 },
        { lookType = 1952, aura = 373 },
        { lookType = 1953 },
        { lookType = 1954 },
        { lookType = 1955 },
        { lookType = 1956 },
        { lookType = 1957 },
        { lookType = 1958 },
        { lookType = 1959 },
        { lookType = 1960 },
        { lookType = 1961 },
        { lookType = 1962 },
        level = 50,
        effect = 240
    },
    -- King Cold
    [25] = {
        { lookType = 1963 },
        { lookType = 1964, aura = 374 },
        { lookType = 1965 },
        { lookType = 1966 },
        { lookType = 1967 },
        { lookType = 1968 },
        { lookType = 1969 },
        { lookType = 1970 },
        { lookType = 1971 },
        { lookType = 1972 },
        level = 50,
        effect = 240
    },
    -- King Vegeta
    [26] = {
        { lookType = 1973 },
        { lookType = 1974, aura = 375 },
        { lookType = 1975 },
        { lookType = 1976 },
        { lookType = 1977 },
        { lookType = 1978 },
        { lookType = 1979 },
        { lookType = 1980 },
        { lookType = 1981 },
        { lookType = 1982 },
        { lookType = 1983 },
        level = 50,
        effect = 240
    },
    -- Kuririn
    [27] = {
        { lookType = 1984 },
        { lookType = 1985, aura = 376 },
        { lookType = 1986 },
        { lookType = 1987 },
        { lookType = 1988 },
        { lookType = 1989 },
        { lookType = 1990 },
        { lookType = 1991 },
        { lookType = 1992 },
        { lookType = 1993 },
        { lookType = 1994 },
        level = 50,
        effect = 240
    },
    -- Liquir
    [28] = {
        { lookType = 1995 },
        { lookType = 1996, aura = 377 },
        { lookType = 1997 },
        { lookType = 1998 },
        { lookType = 1999 },
        { lookType = 2000 },
        { lookType = 2001 },
        { lookType = 2002 },
        level = 50,
        effect = 240
    },
    -- Pan
    [29] = {
        { lookType = 2003 },
        { lookType = 2004, aura = 378 },
        { lookType = 2005 },
        { lookType = 2006 },
        { lookType = 2007 },
        { lookType = 2008 },
        { lookType = 2009 },
        { lookType = 2010 },
        { lookType = 2011 },
        level = 50,
        effect = 240
    },
    -- Piccolo
    [30] = {
        { lookType = 2012 },
        { lookType = 2013, aura = 379 },
        { lookType = 2014 },
        { lookType = 2015 },
        { lookType = 2016 },
        { lookType = 2017 },
        { lookType = 2018 },
        { lookType = 2019 },
        { lookType = 2020 },
        { lookType = 2021 },
        { lookType = 2022 },
        { lookType = 2023 },
        { lookType = 2024 },
        level = 50,
        effect = 240
    },
    -- Quitela
    [31] = {
        { lookType = 2025 },
        { lookType = 2026, aura = 380 },
        { lookType = 2027 },
        { lookType = 2028 },
        { lookType = 2029 },
        { lookType = 2030 },
        { lookType = 2031 },
        { lookType = 2032 },
        { lookType = 2033 },
        level = 50,
        effect = 240
    },
    -- Raditz
    [32] = {
        { lookType = 2034 },
        { lookType = 2035, aura = 381 },
        { lookType = 2036 },
        { lookType = 2037 },
        { lookType = 2038 },
        { lookType = 2039 },
        { lookType = 2040 },
        { lookType = 2041 },
        level = 50,
        effect = 240
    },
    -- Shenron
    [33] = {
        { lookType = 2048 },
        { lookType = 2049, aura = 382 },
        { lookType = 2050 },
        { lookType = 2621 },
        { lookType = 2782 },
        { lookType = 2047 },
        level = 50,
        effect = 240
    },
    -- Tapion
    [34] = {
        { lookType = 2051 },
        { lookType = 2052, aura = 383 },
        { lookType = 2053 },
        { lookType = 2054 },
        { lookType = 2055 },
        { lookType = 2056 },
        { lookType = 2057 },
        { lookType = 2058 },
        { lookType = 2059 },
        { lookType = 2060 },
        { lookType = 2061 },
        { lookType = 2062 },
        { lookType = 2063 },
        { lookType = 2064 },
        { lookType = 2065 },
        level = 50,
        effect = 240
    },
    -- Trunks
    [35] = {
        { lookType = 2066 },
        { lookType = 2067, aura = 384 },
        { lookType = 2068 },
        { lookType = 2069 },
        { lookType = 2070 },
        { lookType = 2071 },
        { lookType = 2072 },
        { lookType = 2073 },
        { lookType = 2074 },
        { lookType = 2075 },
        { lookType = 2076 },
        { lookType = 2077 },
        { lookType = 2078 },
        level = 50,
        effect = 240
    },
    -- Tsuful
    [36] = {
        { lookType = 2079 },
        { lookType = 2080, aura = 385 },
        { lookType = 2081 },
        { lookType = 2082 },
        { lookType = 2083 },
        { lookType = 2084 },
        { lookType = 2085 },
        { lookType = 2086 },
        { lookType = 2087 },
        { lookType = 2088 },
        { lookType = 2089 },
        { lookType = 2090 },
        { lookType = 2091 },
        { lookType = 2092 },
        level = 50,
        effect = 240
    },
    -- Turles
    [37] = {
        { lookType = 2093 },
        { lookType = 2094, aura = 386 },
        { lookType = 2095 },
        { lookType = 2096 },
        { lookType = 2097 },
        { lookType = 2098 },
        { lookType = 2099 },
        { lookType = 2100 },
        { lookType = 2101 },
        { lookType = 2102 },
        { lookType = 2103 },
        { lookType = 2104 },
        { lookType = 2105 },
        level = 50,
        effect = 240
    },
    -- Uub
    [38] = {
        { lookType = 2106 },
        { lookType = 2107, aura = 387 },
        { lookType = 2108 },
        { lookType = 2109 },
        { lookType = 2110 },
        { lookType = 2111 },
        { lookType = 2112 },
        level = 50,
        effect = 240
    },
    -- Vados
    [39] = {
        { lookType = 2113 },
        { lookType = 2114, aura = 388 },
        { lookType = 2115 },
        { lookType = 2116 },
        { lookType = 2117 },
        { lookType = 2118 },
        { lookType = 2119 },
        { lookType = 2120 },
        level = 50,
        effect = 240
    },
    -- Vegeta
    [40] = {
        { lookType = 2121 },
        { lookType = 2122, aura = 389 },
        { lookType = 2123 },
        { lookType = 2124 },
        { lookType = 2125 },
        { lookType = 2126 },
        { lookType = 2127 },
        { lookType = 2128 },
        { lookType = 2129 },
        { lookType = 2130 },
        { lookType = 2131 },
        { lookType = 2132 },
        { lookType = 2133 },
        { lookType = 2134 },
        level = 50,
        effect = 240
    },
    -- Vegetto
    [41] = {
        { lookType = 2135 },
        { lookType = 2136, aura = 390 },
        { lookType = 1937 },
        { lookType = 2138 },
        { lookType = 2139 },
        { lookType = 2140 },
        { lookType = 2141 },
        { lookType = 2142 },
        { lookType = 2143 },
        level = 50,
        effect = 240
    },
    -- Vermouth
    [42] = {
        { lookType = 1697 },
        { lookType = 1695, aura = 391 },
        { lookType = 1696 },
        { lookType = 1698 },
        { lookType = 1699 },
        { lookType = 1700 },
        { lookType = 1701 },
        { lookType = 1702 },
        { lookType = 1703 },
        { lookType = 1704 },
        { lookType = 1707 },
        { lookType = 1705 },
        { lookType = 1706 },
        { lookType = 1708 },
        level = 50,
        effect = 240
    },
    -- Videl
    [43] = {
        { lookType = 2144 },
        { lookType = 2145, aura = 392 },
        { lookType = 2146 },
        { lookType = 2147 },
        { lookType = 2148 },
        { lookType = 2149 },
        { lookType = 2150 },
        level = 50,
        effect = 240
    },
    -- Zaiko
    [44] = {
        { lookType = 2151 },
        { lookType = 2152, aura = 393 },
        { lookType = 2153 },
        { lookType = 2154 },
        { lookType = 2155 },
        { lookType = 2156 },
        { lookType = 2157 },
        { lookType = 2158 },
        { lookType = 2159 },
        { lookType = 2160 },
        { lookType = 2161 },
        { lookType = 2162 },
        level = 50,
        effect = 240
    },
    -- Zeno
    [45] = {
        { lookType = 2163 },
        { lookType = 2164, aura = 394 },
        { lookType = 2165 },
        { lookType = 2166 },
        { lookType = 2167 },
        { lookType = 2168 },
        { lookType = 2169 },
        { lookType = 2170 },
        { lookType = 2171 },
        level = 50,
        effect = 240
    },
    -- Aizen
    [47] = {
        { lookType = 2176 },
        { lookType = 2177 },
        { lookType = 2178 },
        { lookType = 2179 },
        { lookType = 2180 },
        { lookType = 2175 },
        { lookType = 2174 },
        { lookType = 2173 },
        { lookType = 2172 },
        { lookType = 2620 },
        level = 50,
        effect = 240
    },
    -- Byakuya
    [48] = {
        { lookType = 2185 },
        { lookType = 2186, aura = 396 },
        { lookType = 2187 },
        { lookType = 2188 },
        { lookType = 2189 },
        { lookType = 2190 },
        { lookType = 2183 },
        { lookType = 2184 },
        level = 50,
        effect = 240
    },
    -- Gin
    [49] = {
        { lookType = 2193 },
        { lookType = 2194, aura = 397 },
        { lookType = 2195 },
        { lookType = 2196 },
        { lookType = 2192 },
        { lookType = 2191 },
        level = 50,
        effect = 240
    },
    -- Grimmjow
    [50] = {
        { lookType = 2199 },
        { lookType = 2201, aura = 398 },
        { lookType = 2200 },
        { lookType = 2202 },
        { lookType = 2198 },
        { lookType = 2197 },
        level = 50,
        effect = 240
    },
    -- Hitsugaya
    [51] = {
        { lookType = 2207 },
        { lookType = 2211, aura = 399 },
        { lookType = 2210 },
        { lookType = 2209 },
        { lookType = 2206 },
        { lookType = 2208 },
        { lookType = 2212 },
        { lookType = 2204 },
        { lookType = 2205 },
        level = 50,
        effect = 240
    },
    -- Ichigo FullBring
    [52] = {
        { lookType = 2218 },
        { lookType = 2221, aura = 400 },
        { lookType = 2217 },
        { lookType = 2216 },
        { lookType = 2215 },
        { lookType = 2214 },
        { lookType = 2213 },
        level = 50,
        effect = 240
    },
    -- Ichigo
    [53] = {
        { lookType = 2227 },
        { lookType = 2234, aura = 401 },
        { lookType = 2233 },
        { lookType = 2230 },
        { lookType = 2232 },
        { lookType = 2231 },
        { lookType = 2229 },
        { lookType = 2224 },
        { lookType = 2223 },
        { lookType = 2228 },
        { lookType = 2235 },
        { lookType = 2226 },
        { lookType = 2225 },
        { lookType = 2222 },
        { lookType = 2221 },
        { lookType = 2220 },
        { lookType = 2219 },
        level = 50,
        effect = 240
    },
    -- Ishida
    [54] = {
        { lookType = 2239 },
        { lookType = 2242, aura = 402 },
        { lookType = 2241 },
        { lookType = 2243 },
        { lookType = 2240 },
        { lookType = 2238 },
        { lookType = 2237 },
        { lookType = 2236 },
        level = 50,
        effect = 240
    },
    -- Kyouraku
    [55] = {
        { lookType = 2250 },
        { lookType = 2247, aura = 403 },
        { lookType = 2249 },
        { lookType = 2248 },
        { lookType = 2251 },
        { lookType = 2246 },
        { lookType = 2245 },
        { lookType = 2244 },
        level = 50,
        effect = 240
    },
    -- Neliel
    [56] = {
        { lookType = 2255 },
        { lookType = 2258, aura = 404 },
        { lookType = 2257 },
        { lookType = 2256 },
        { lookType = 2259 },
        { lookType = 2254 },
        { lookType = 2253 },
        { lookType = 2252 },
        level = 50,
        effect = 240
    },
    -- Orihime
    [57] = {
        { lookType = 2262 },
        { lookType = 2263, aura = 405 },
        { lookType = 2264 },
        { lookType = 2261 },
        { lookType = 2260 },
        level = 50,
        effect = 240
    },
    -- Renji
    [58] = {
        { lookType = 2268 },
        { lookType = 2271, aura = 342 },
        { lookType = 2270 },
        { lookType = 2269 },
        { lookType = 2272 },
        { lookType = 2267 },
        { lookType = 2266 },
        { lookType = 2265 },
        level = 50,
        effect = 240
    },
    -- Rukia
    [59] = {
        { lookType = 2276 },
        { lookType = 2278, aura = 407 },
        { lookType = 2277 },
        { lookType = 2279 },
        { lookType = 2275 },
        { lookType = 2274 },
        { lookType = 2273 },
        level = 50,
        effect = 240
    },
    -- Sado
    [60] = {
        { lookType = 2280 },
        { lookType = 2283, aura = 408 },
        { lookType = 2285 },
        { lookType = 2284 },
        { lookType = 2286 },
        { lookType = 2282 },
        { lookType = 2281 },
        level = 50,
        effect = 240
    },
    -- Shinji
    [61] = {
        { lookType = 2291 },
        { lookType = 2295, aura = 409 },
        { lookType = 2294 },
        { lookType = 2293 },
        { lookType = 2292 },
        { lookType = 2296 },
        { lookType = 2290 },
        { lookType = 2289 },
        { lookType = 2288 },
        { lookType = 2287 },
        level = 50,
        effect = 240
    },
    -- Soi Fong
    [62] = {
        { lookType = 2303 },
        { lookType = 2304, aura = 410 },
        { lookType = 2302 },
        { lookType = 2301 },
        { lookType = 2300 },
        { lookType = 2299 },
        { lookType = 2298 },
        { lookType = 2297 },
        level = 50,
        effect = 240
    },
    -- Tousen
    [63] = {
        { lookType = 2309 },
        { lookType = 2308, aura = 411 },
        { lookType = 2310 },
        { lookType = 2307 },
        { lookType = 2306 },
        { lookType = 2305 },
        level = 50,
        effect = 240
    },
    -- Ulquiorra
    [64] = {
        { lookType = 2315 },
        { lookType = 2318, aura = 412 },
        { lookType = 2317 },
        { lookType = 2316 },
        { lookType = 2319 },
        { lookType = 2314 },
        { lookType = 2313 },
        { lookType = 2312 },
        { lookType = 2311 },
        level = 50,
        effect = 240
    },
    -- Urahara
    [65] = {
        { lookType = 2323 },
        { lookType = 2325, aura = 413 },
        { lookType = 2324 },
        { lookType = 2326 },
        { lookType = 2321 },
        { lookType = 2322 },
        { lookType = 2320 },
        level = 50,
        effect = 240
    },
    -- Yoruichi
    [66] = {
        { lookType = 2332 },
        { lookType = 2331, aura = 414 },
        { lookType = 2330 },
        { lookType = 2329 },
        { lookType = 2333 },
        { lookType = 2328 },
        { lookType = 2327 },
        level = 50,
        effect = 240
    },
    -- Zaraki
    [67] = {
        { lookType = 2339 },
        { lookType = 2343, aura = 415 },
        { lookType = 2338 },
        { lookType = 2342 },
        { lookType = 2341 },
        { lookType = 2340 },
        { lookType = 2344 },
        { lookType = 2337 },
        { lookType = 2336 },
        { lookType = 2335 },
        { lookType = 2334 },
        level = 50,
        effect = 240
    },
}

sagastor = 578744
effectStorage = 578745
transformExhaustStorage = 120
defaultTransformEffect = 240

function getTransformEffectPos(cid, sagaData, outfitData)
    local pos = getThingPos(cid)
    local outfit = getCreatureOutfit(cid)
    if outfit and outfit.lookMount and outfit.lookMount > 0 then
        pos.y = pos.y - 1
    end
    local offset = (outfitData and outfitData.effectPos) or (sagaData and sagaData.effectPos)
    if offset then
        pos.x = pos.x + (offset.x or 0)
        pos.y = pos.y + (offset.y or 0)
        pos.z = pos.z + (offset.z or 0)
    end
    return pos
end

function sendContinuousEffect(cid, effectId, offset, generation)
    if isPlayer(cid) and getPlayerStorageValue(cid, effectStorage) == generation then
        local pos = getThingPos(cid)
        if offset then
            pos.x = pos.x + (offset.x or 0)
            pos.y = pos.y + (offset.y or 0)
            pos.z = pos.z + (offset.z or 0)
        end
        doSendMagicEffect(pos, effectId)
        addEvent(sendContinuousEffect, 1000, cid, effectId, offset, generation)
    end
end

-- Gera a prxima geraǜo de forma monotnica e a armazena.
-- Como nunca volta para um valor já usado, loops antigos (com gen menor) sempre param.
function nextAuraGen(cid)
    local current = getPlayerStorageValue(cid, effectStorage)
    local gen = (current > 0 and current or 0) + 1
    setPlayerStorageValue(cid, effectStorage, gen)
    return gen
end

-- Inicia loop de aura com nova geraǜo ?" invalida automaticamente qualquer loop anterior.
function startAura(cid, effectId, offset)
    local gen = nextAuraGen(cid)
    sendContinuousEffect(cid, effectId, offset, gen)
end

-- Para o loop ativo incrementando a geraǜo (sem resetar).
-- Loops antigos agendados no addEvent vǜo falhar no prximo tick pois sua geraǜo nǜo bate mais.
function stopAura(cid)
    nextAuraGen(cid)
end

-- Pre-calculate all saga lookTypes for efficient cleanup
allSagaLookTypes = {}
for vocId, sagaData in pairs(saga) do
    for _, outfit in ipairs(sagaData) do
        if type(outfit) == "table" and outfit.lookType then
            allSagaLookTypes[outfit.lookType] = true
        end
    end
end

function updatePlayerOutfits(cid)
    if not isPlayer(cid) then return end

    local voc = getPlayerVocation(cid)
    local level = getPlayerLevel(cid)
    local sagaData = saga[voc]
    local isPrem = isPremium(cid)
    local STORAGE_BASE = 59000

    -- 1. CLEANUP: Remove ALL saga lookTypes from player's list
    -- This ensures that only the current vocation's outfits are "known" to the player object
    for lookType, _ in pairs(allSagaLookTypes) do
        doPlayerRemOutfit(cid, lookType)
    end

    -- 2. SET UP CURRENT VOCATION:
    -- We set the vocation storage so the ENGINE (C++) can filter results in the window
    -- Outfits.xml uses storageId = 59000 + vocationId
    setPlayerStorageValue(cid, STORAGE_BASE + voc, level)

    -- 3. ADD Saga Transformations for the CURRENT vocation
    -- We add ALL of them to the player's list.
    -- The engine's canWearOutfit will then filter which ones appear in the window based on level.
    if sagaData then
        for _, outfit in ipairs(sagaData) do
            if type(outfit) == "table" and outfit.lookType then
                doPlayerAddOutfit(cid, outfit.lookType, 0)
            end
        end
    end

    -- 4. Handle Extra Outfits (Standard logic)
    for _, outfit in ipairs(extraOutfits) do
        -- ... (mantemos a lógica original aqui)
        local canAdd = true
        if outfit.level and level < outfit.level then canAdd = false end
        if outfit.premium and not isPrem then canAdd = false end
        if outfit.vocation and not table.contains(outfit.vocation, voc) then canAdd = false end
        if outfit.storage and getPlayerStorageValue(cid, outfit.storage) < 1 then canAdd = false end

        if canAdd then
            doPlayerAddOutfit(cid, outfit.lookType, 0)
        else
            doPlayerRemOutfit(cid, outfit.lookType)
        end
    end

    -- 4. Clean up: If player is currently wearing an outfit they shouldn't, reset to base
    local current = getCreatureOutfit(cid)
    if not canPlayerWearLookType(cid, current.lookType) then
        if sagaData and sagaData[1] then
            doCreatureChangeOutfit(cid, { lookType = sagaData[1].lookType })
        end
    end
end

-- Helper to check if player can wear a looktype (optional but good for safety)
function canPlayerWearLookType(cid, lookType)
    local voc = getPlayerVocation(cid)
    local level = getPlayerLevel(cid)

    -- Check saga
    local sagaData = saga[voc]
    if sagaData then
        local base = sagaData.level or 50
        for i, outfit in ipairs(sagaData) do
            if type(outfit) == "table" and outfit.lookType == lookType then
                local reqLevel = (i == 1) and 1 or (i - 1) * base
                return level >= reqLevel
            end
        end
    end

    -- Check extras
    for _, outfit in ipairs(extraOutfits) do
        if outfit.lookType == lookType then
            if outfit.level and level < outfit.level then return false end
            if outfit.vocation and not table.contains(outfit.vocation, voc) then return false end
            if outfit.storage and getPlayerStorageValue(cid, outfit.storage) < 1 then return false end
            return true
        end
    end

    return true -- Default allow for system/GM outfits if not in tables
end

function table.contains(t, val)
    for _, v in pairs(t) do
        if v == val then return true end
    end
    return false
end
