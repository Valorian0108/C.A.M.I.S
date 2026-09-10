import fitz, os
path='attached_assets/my_build_for_Bitget_s2_hackathon__1789010130989.pdf'
doc=fitz.open(path)
print('pages', doc.page_count)
print('metadata', doc.metadata)
for i, page in enumerate(doc):
    pix=page.get_pixmap(matrix=fitz.Matrix(1.5,1.5), alpha=False)
    out=f'.agents/outputs/bitget-page-{i+1}.png'
    pix.save(out)
    print(i+1, page.rect, out, os.path.getsize(out))
