"""კატეგორიების კონფიგურაცია — კედლის და იატაკის მასალები.

slug-ები რეალურია (გადამოწმდა საიტებზე 2026-06).
ახალი კატეგორიის დასამატებლად უბრალოდ ჩაამატე სიაში.
"""

# --- Nova.ge --- (URL: https://nova.ge/ka/<slug>)
NOVA_CATEGORIES = [
    "iatakis-da-kedlis-filebi",   # იატაკის და კედლის ფილები (მეტლახი/კაფელი)
    "laminati",                   # ლამინატი
    "iatakis-safari",             # იატაკის საფარი
    "laq-saghebavi-dekori",       # ლაქ-საღებავი / დეკორი
]

# --- Domino.com.ge --- (URL: https://www.domino.com.ge/products/<path>/)
# ქართული path-ები ნორმალურია — requests თვითონ აკოდირებს.
DOMINO_CATEGORIES = [
    "tile/იატაკის-ფილა",                          # იატაკის ფილა
    "tile/კერამიკული-ფილა",                       # კერამიკული (კედლის) ფილა
    "tile/კერამოგრანიტი",                         # კერამოგრანიტი
    "tile/კლინკერის-ფილა",                        # კლინკერის ფილა
    "floor-coverings/laminate-flooring",          # ლამინატი
    "building-materials/კედლის-და-ფასადის-მასალები",  # კედლის და ფასადის მასალები
]
