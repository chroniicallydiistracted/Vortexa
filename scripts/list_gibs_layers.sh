#!/bin/bash
grep "Identifier" logs/wmts_pick.log | awk -F': ' '{print $2}'