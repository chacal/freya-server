tt_nmea_utils
=============

Utilities for TackTick boat instrument system.

Currently includes only a start of true wind calibration facilities.

To try it out:

    > npm install
    > node nmea_sender.js testdata/Freya_20140913_1638.log | node true_wind_adjuster.js

First it reads the partially filled calibration table from tws_correction_table.csv, fills it by interpolating and starts to feed test data into it.
