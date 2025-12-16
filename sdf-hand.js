import * as THREE from "three";
import { SplatEdit, SplatEditRgbaBlendMode, SplatEditSdf, SplatEditSdfType } from "@sparkjsdev/spark";

let splatEdit = null;
const handSdfs = new Map();

// Initialize SDF hand tracking
export function initializeSDFHands(sparkScene) {
  // Create SplatEdit layer for SDF highlighting (in localFrame space - for VR hands)
  splatEdit = new SplatEdit({
    rgbaBlendMode: SplatEditRgbaBlendMode.ADD_RGBA,
    sdfSmooth: 0.02,
    softEdge: 0.02,
  });
  sparkScene.localFrame.add(splatEdit);
}

// Update SDF hand tracking each frame
export function updateSDFHands(sparkScene, time) {
  if (!splatEdit) return;
  if (!sparkScene.renderer.xr.isPresenting || !sparkScene.xr) return;

  // Get hands from SparkXr
  const hands = {
    left: sparkScene.xr.left(),
    right: sparkScene.xr.right()
  };

  // Create interactor SDFs for each hand tip
  for (const [handName, hand] of Object.entries(hands)) {
    const handValid = hand?.valid();
    
    for (const [index, tip] of ["t3", "i4", "m4", "r4", "p4"].entries()) {
      // Make a sphere SDF for each hand tip with different colors
      const key = `${handName}-${tip}`;
      if (!handSdfs.has(key)) {
        const sdf = new SplatEditSdf({
          type: SplatEditSdfType.SPHERE,
          radius: 0.03,
          color: new THREE.Color(
            (index % 5 < 3) ? 1 : 0,
            (index % 5 % 2),
            ((index % 5) > 1) ? 1 : 0
          ),
          opacity: 0,
        });
        handSdfs.set(key, sdf);
      }

      const sdf = handSdfs.get(key);
      // Make each SDF wobble in different directions
      sdf.displace.set(
        0.01 * Math.sin(time * 0.007 + index * 1),
        0.01 * Math.sin(time * 0.002 + index * 2),
        0.01 * Math.sin(time * 0.009 + index * 3),
      );

      if (handValid && hand[tip]?.position) {
        // Make the SDF follow the hand tips
        sdf.position.copy(hand[tip].position);
        splatEdit.add(sdf);
      } else {
        // Remove the SDF when the hand is not detected
        splatEdit.remove(sdf);
      }
    }
  }
}

