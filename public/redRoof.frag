// Costume-Shader, der die Dächer rot einfärbt

void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material)
{
    // Im Fragment-Shader ist nur normalEC (Eye-Koordinaten) verfuegbar.
    // Dieser muss in World-Koordinaten umgerechnet werden
    vec3 normalWC = normalize(czm_inverseViewRotation * fsInput.attributes.normalEC);

    // Lokale "Oben"-Richtung an dieser Position (geozentrische Normale).
    vec3 up = normalize(fsInput.attributes.positionWC.xyz);

    // Daecher / nach oben zeigende Flaechen rot faerben
    if (dot(normalWC, up) > 0.5) {
        material.diffuse = vec3(0.75, 0.05, 0.03);
        material.roughness = 0.7;
    }
}
