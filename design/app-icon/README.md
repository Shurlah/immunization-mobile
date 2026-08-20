# App icon source

- `icon-master.svg` — full-bleed 1024x1024 icon (background gradient + syringe), used to
  generate the legacy square/round launcher PNGs (`mipmap-*/ic_launcher.png`,
  `ic_launcher_round.png`).
- `icon-foreground.svg` — transparent-background version of the same syringe, scaled and
  centered to stay within Android's adaptive-icon safe zone (inner ~66% circle of a 108dp
  canvas). Used to generate `mipmap-*/ic_launcher_foreground.png`, referenced by the
  adaptive icon XMLs in `mipmap-anydpi-v26/`. Background color for the adaptive icon lives
  in `values/colors.xml` as `ic_launcher_background` (`#14614f`).

To regenerate the PNGs after editing either SVG (requires Inkscape):

```bash
RES=android/app/src/main/res

# Legacy square + round icons
for pair in "mdpi:48" "hdpi:72" "xhdpi:96" "xxhdpi:144" "xxxhdpi:192"; do
  density="${pair%%:*}"; size="${pair##*:}"
  inkscape design/app-icon/icon-master.svg --export-type=png \
    --export-filename="$RES/mipmap-${density}/ic_launcher.png" -w "$size" -h "$size"
  cp "$RES/mipmap-${density}/ic_launcher.png" "$RES/mipmap-${density}/ic_launcher_round.png"
done

# Adaptive icon foreground layer
for pair in "mdpi:108" "hdpi:162" "xhdpi:216" "xxhdpi:324" "xxxhdpi:432"; do
  density="${pair%%:*}"; size="${pair##*:}"
  inkscape design/app-icon/icon-foreground.svg --export-type=png \
    --export-filename="$RES/mipmap-${density}/ic_launcher_foreground.png" \
    -w "$size" -h "$size" --export-background-opacity=0
done
```
